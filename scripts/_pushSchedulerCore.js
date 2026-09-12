// Motor de notificaciones push automáticas — la lógica real vive acá,
// compartida por 2 Netlify Scheduled Functions con distinta frecuencia (ver
// netlify/functions/push-scheduler-sabado.js y -semana.js): la mayoría de
// los cambios en el sheet (cargar el horario de un partido, corregir un
// dato) pasan entre semana y no son urgentes, pero el día del partido
// (sábado) sí conviene revisar seguido para que Recordatorio/Comienzo/Final
// del partido lleguen con sentido. Un solo cron no puede tener 2
// frecuencias distintas, así que son 2 archivos de función separados que
// llaman a este mismo `runOnce`.
//
// Cómo detecta "algo pasó": guarda en Netlify Blobs una foto del estado de
// cada torneo (qué partidos tienen resultado, hora, plantel citado) en cada
// corrida, y la compara contra la foto de la corrida anterior. Un campo que
// pasó de vacío a con dato = dispara el push correspondiente. Así cada regla
// nueva que se agregue después es, en el fondo, "¿qué campo cambió", no una
// arquitectura aparte por regla.
//
// Las 9 reglas acordadas, todas implementadas:
//   1. Horario de partido confirmado
//   2. Citación y 11 probable (plantel cargado)
//   3. Recordatorio (2h antes) + Comienzo del partido — únicas 2 que
//      disparan por RELOJ contra la hora ya cargada, no por diff de
//      snapshot entre corridas
//   4. Final del partido (resultado cargado)
//   5. Tabla de posiciones + Próximo rival (combinados, mismo trigger que 4)
//   6. Logros — Debut, Primer gol, Hat-trick, Cifra redonda de goles en el
//      club (mismo trigger que 4, salvo Cifra redonda que vive en
//      checkElNido junto al resto de El Nido)
//   7. Racha en juego del equipo (invicto) + racha de vallas invictas de un
//      arquero puntual — ambas al cruzar un hito redondo, no partido a
//      partido
//   8. Entró al Top 10 de El Nido — General/Primera A/Primera B, por
//      categoría (ver checkElNido más abajo)
const { getStore } = require('@netlify/blobs');
const { getAllMatches, getTabla, getElNidoRankings, SITE_URL, TORNEO_CFG } = require('./_matchPartidoData');

const ONESIGNAL_APP_ID = '313bdf7f-d8ce-4ef4-868d-bfbe78d0ccee';
// Secreta — nunca hardcodeada. Se configura como variable de entorno en
// Netlify (Site settings → Environment variables → ONESIGNAL_REST_API_KEY),
// nunca commiteada al repo.
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

const STORE_NAME = 'push-state';

async function sendPush(title, message, url) {
  if (!ONESIGNAL_REST_API_KEY) {
    console.error('push-scheduler: falta ONESIGNAL_REST_API_KEY — no se puede enviar el push:', title);
    return;
  }
  try {
    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Subscribed Users'],
        headings: { en: title },
        contents: { en: message },
        url,
      }),
    });
    if (!r.ok) console.error('push-scheduler: OneSignal respondió', r.status, await r.text());
  } catch (e) {
    console.error('push-scheduler: falló el POST a OneSignal:', e);
  }
}

// Snapshot mínimo por partido — solo los campos que estas 3 reglas
// necesitan comparar contra la corrida anterior. Sumar una regla nueva más
// adelante puede significar sumar un campo acá, no rearmar esto.
function snapshotOf(m) {
  return {
    resultado: m.resultado,
    hora: m.hora || '',
    citado: (m.jugadores || []).length > 0,
  };
}

// Primer partido pendiente (sin resultado todavía) por número de fecha —
// mismo criterio que ya usa _teamNextMatch en index.html para "Próximo
// Partido" del home, reimplementado acá liviano (sin necesitar el resto de
// ese helper) porque solo hace falta rival+fecha, no todo el objeto match.
function proximoPendiente(matches) {
  const pendientes = matches
    .filter(m => m.resultado === null && /^\d+$/.test(String(m.fecha)))
    .sort((a, b) => parseInt(a.fecha) - parseInt(b.fecha));
  return pendientes[0] || null;
}

// El sheet guarda gf/gc en orden Local-Visitante, no CSB-Rival fijo — mismo
// criterio que ya usa buildFechaDetailHTML/_csbGoles en index.html: de
// visitante (o cancha neutral), el gol de CSB es el SEGUNDO número.
function csbGoles(m) {
  if (m.gf == null || m.gc == null) return null;
  const l = String(m.local || '').toUpperCase();
  const esVisitanteONeutral = l === 'VISITANTE' || l === 'NEUTRAL';
  return { csb: esVisitanteONeutral ? m.gc : m.gf, riv: esVisitanteONeutral ? m.gf : m.gc };
}

// Racha invicto actual: partidos jugados consecutivos (de más reciente hacia
// atrás) sin perder — se corta en la primera derrota o en el primer partido
// sin gf/gc cargado.
function calcRachaInvicto(matches) {
  const jugados = matches
    .filter(m => m.resultado !== null && /^\d+$/.test(String(m.fecha)))
    .sort((a, b) => parseInt(a.fecha) - parseInt(b.fecha));
  let streak = 0;
  for (let i = jugados.length - 1; i >= 0; i--) {
    const goles = csbGoles(jugados[i]);
    if (!goles || goles.csb < goles.riv) break;
    streak++;
  }
  return streak;
}
const RACHA_HITOS = [5, 10, 15, 20, 25, 30, 40, 50];
// Racha de vallas invictas de UN arquero puntual (a diferencia de la racha
// invicto del equipo, de arriba) — hitos más bajos porque es una racha
// individual, no la del equipo completo.
const VALLAS_JUGADOR_HITOS = [3, 5, 10, 15, 20];

// Racha actual de vallas invictas de cada arquero que arrancó de titular —
// solo cuenta los partidos donde ESE arquero fue titular (no rompe la racha
// que otro haya jugado en el medio), cortando en el primer gol recibido con
// él en el arco. Reusa csbGoles/el mismo `local` para saber cuántos goles
// recibió el equipo en cada partido.
function calcRachasVallasPorArquero(matches) {
  const porArquero = new Map();
  const jugados = matches
    .filter(m => m.resultado !== null && /^\d+$/.test(String(m.fecha)))
    .sort((a, b) => parseInt(a.fecha) - parseInt(b.fecha));
  for (const m of jugados) {
    const arq = (m.jugadores || []).find(j => j.titular && String(j.pos || '').toUpperCase() === 'ARQ');
    const goles = csbGoles(m);
    if (!arq || !arq.nombre || !goles) continue;
    if (!porArquero.has(arq.nombre)) porArquero.set(arq.nombre, []);
    porArquero.get(arq.nombre).push(goles.riv === 0);
  }
  const rachas = {};
  for (const [nombre, vallas] of porArquero) {
    let streak = 0;
    for (let i = vallas.length - 1; i >= 0 && vallas[i]; i--) streak++;
    rachas[nombre] = streak;
  }
  return rachas;
}

// Recordatorio (X horas antes) + Comienzo del partido — el único par de
// reglas que dispara por RELOJ contra la hora ya cargada, no por un cambio
// de dato entre corridas. Cada uno se manda una sola vez por fecha (flag
// persistido en el propio snapshot de esa fecha).
const RECORDATORIO_MS = 2 * 60 * 60 * 1000; // 2 horas antes del partido
// Más que el intervalo del cron más lento (push-scheduler-semana, cada 2h):
// si una corrida se atrasa o se saltea, esta ventana sigue cubriendo el
// "recién arrancó" en la próxima.
const COMIENZO_GRACE_MS = 2 * 60 * 60 * 1000 + 10 * 60 * 1000;

async function checkTorneo(store, torneo) {
  const data = await getAllMatches(torneo);
  if (!data) return;
  const { matches, helpers } = data;
  const badge = TORNEO_CFG[torneo].badge;
  const stateKey = `estado-${torneo}`;
  const prev = (await store.get(stateKey, { type: 'json' })) || { matches: {}, tablaPos: null, racha: 0 };
  const nextMatches = {};
  let huboFinal = false;

  // Logros (Debut/Primer gol/Hat-trick) — "vistos"/"conGol" son el
  // histórico de jugadores que YA jugaron/YA convirtieron alguna vez,
  // persistido en Blobs junto al resto del estado del torneo. Si esta
  // regla nunca corrió antes (prev.jugadoresVistos no existe), se arma esa
  // base UNA vez a partir de los partidos YA jugados sin avisar nada — si
  // no, el primer cierre de fecha después de activar esto "descubriría"
  // como debut/primer gol a jugadores con años de historia.
  const esSeedInicial = !prev.jugadoresVistos;
  const vistos = new Set(prev.jugadoresVistos || []);
  const conGol = new Set(prev.jugadoresConGol || []);
  if (esSeedInicial) {
    for (const m of matches) {
      if (m.resultado === null) continue;
      for (const j of (m.jugadores || [])) {
        if (!j.nombre) continue;
        if (j.titular || j.entro) vistos.add(j.nombre);
        if (j.goles > 0) conGol.add(j.nombre);
      }
    }
  }

  for (const m of matches) {
    const fecha = String(m.fecha);
    const prevM = prev.matches[fecha] || null;
    const curr = snapshotOf(m);
    const url = `${SITE_URL}/#partido/${torneo}/${encodeURIComponent(fecha)}`;

    // Recordatorio/Comienzo — a propósito ANTES del "if (!prevM) continue"
    // de acá abajo: a diferencia del resto de las reglas (que solo importan
    // si YA había una corrida anterior con qué comparar), estas dos tienen
    // que poder dispararse incluso la primera vez que se ve una fecha, si
    // esa fecha ya viene con hora cargada y cae dentro de la ventana.
    curr.recordatorioEnviado = !!(prevM && prevM.recordatorioEnviado);
    curr.comienzoEnviado = !!(prevM && prevM.comienzoEnviado);
    if (m.resultado === null && m.dia && m.hora) {
      try {
        const kickoff = helpers.parseFechaHora(m.dia, m.hora);
        if (kickoff) {
          const msFalta = kickoff.getTime() - Date.now();
          if (!curr.recordatorioEnviado && msFalta > 0 && msFalta <= RECORDATORIO_MS) {
            const horas = (msFalta / 3600000).toFixed(1);
            await sendPush('⏰ Recordatorio', `Santa Bárbara vs ${m.rival} en ${horas}h — Fecha ${fecha} (${badge})`, url);
            curr.recordatorioEnviado = true;
          }
          if (!curr.comienzoEnviado && msFalta <= 0 && -msFalta <= COMIENZO_GRACE_MS) {
            await sendPush('🏟️ ¡Arrancó el partido!', `Santa Bárbara vs ${m.rival} — ${badge}`, url);
            curr.comienzoEnviado = true;
          }
        }
      } catch (e) {
        console.error(`push-scheduler: no se pudo calcular kickoff (${torneo} Fecha ${fecha}):`, e);
      }
    }
    nextMatches[fecha] = curr;

    // Primera corrida de un partido nunca visto antes: no hay "antes" con
    // qué comparar — se guarda tal cual está ahora, sin disparar nada. Si
    // no hiciéramos esto, el primer partido cargado en el sheet dispararía
    // sus 3 avisos de golpe en la primera corrida después del deploy.
    if (!prevM) continue;

    if (curr.hora && !prevM.hora) {
      await sendPush(
        '🗓️ Horario confirmado',
        `Santa Bárbara vs ${m.rival} — Fecha ${fecha} (${badge}), ${m.hora}`,
        url
      );
    }
    if (curr.citado && !prevM.citado) {
      await sendPush(
        '📋 Citación confirmada',
        `Ya está el plantel citado — Santa Bárbara vs ${m.rival}, Fecha ${fecha}`,
        url
      );
    }
    if (curr.resultado && !prevM.resultado) {
      await sendPush(
        '⚽ Final del partido',
        `Santa Bárbara ${curr.resultado}${m.penales ? ` (pen. ${m.penales})` : ''} vs ${m.rival}`,
        url
      );
      huboFinal = true;

      // Logros de este partido. El hat-trick no depende de historial
      // (solo mira ESTE partido), así que se avisa siempre; debut/primer
      // gol si dependen de "vistos"/"conGol" — en la corrida de seed
      // inicial esos sets recién se están armando, así que no se avisa
      // nada ahí (pasarían como "debut" jugadores con años de historia).
      for (const j of (m.jugadores || [])) {
        if (!j.nombre) continue;
        const jugo = j.titular || j.entro;
        if (!esSeedInicial && jugo && !vistos.has(j.nombre)) {
          await sendPush('🎓 Debut', `${j.nombre} debutó en Primera — vs ${m.rival}, Fecha ${fecha}`, url);
        }
        if (!esSeedInicial && j.goles > 0 && !conGol.has(j.nombre)) {
          await sendPush('🎯 Primer gol', `${j.nombre} convirtió su primer gol — vs ${m.rival}, Fecha ${fecha}`, url);
        }
        if (!esSeedInicial && j.goles >= 3) {
          await sendPush('🎩 Hat-trick', `${j.nombre} convirtió ${j.goles} goles — vs ${m.rival}, Fecha ${fecha}`, url);
        }
        if (jugo) vistos.add(j.nombre);
        if (j.goles > 0) conGol.add(j.nombre);
      }
    }
  }

  // Tabla de posiciones + Próximo rival — combinados en un solo push (mismo
  // trigger: se cerró una fecha), en vez de 2 avisos separados por lo mismo.
  let nextTablaPos = prev.tablaPos;
  let nextRacha = prev.racha || 0;
  let nextVallasRachaJugador = prev.vallasRachaJugador || {};
  if (huboFinal) {
    try {
      const tabla = await getTabla(torneo);
      const fila = (tabla || []).find(t => t.csb);
      nextTablaPos = fila ? parseInt(fila.pos) : prev.tablaPos;
      const proximo = proximoPendiente(matches);
      const posTxt = fila
        ? (prev.tablaPos && prev.tablaPos !== nextTablaPos
          ? `Posición: ${fila.pos} (antes ${prev.tablaPos}°)`
          : `Posición: ${fila.pos}`)
        : null;
      const rivalTxt = proximo ? `Próximo: vs ${proximo.rival} (Fecha ${proximo.fecha})` : null;
      const partes = [posTxt, rivalTxt].filter(Boolean);
      if (partes.length) {
        await sendPush(`📊 Tabla actualizada — ${badge}`, partes.join(' · '), `${SITE_URL}/#posiciones`);
      }
    } catch (e) {
      console.error(`push-scheduler: falló tabla/próximo rival (${torneo}):`, e);
    }

    // Racha en juego — solo avisa al CRUZAR un hito redondo (5/10/15...),
    // no en cada partido dentro de la racha (eso sí sería spam).
    nextRacha = calcRachaInvicto(matches);
    const hito = RACHA_HITOS.find(h => nextRacha >= h && (prev.racha || 0) < h);
    if (hito) {
      await sendPush(
        '🔥 Racha en juego',
        `Santa Bárbara lleva ${nextRacha} partidos invicto — ${badge}`,
        `${SITE_URL}/#posiciones`
      );
    }

    // Racha de vallas invictas de UN arquero puntual — mismo criterio de
    // "solo avisa al cruzar un hito", pero por jugador en vez de por
    // equipo. Se recalcula desde matches completo (no incrementalmente),
    // así que queda al día incluso para arqueros que no jugaron esta fecha.
    nextVallasRachaJugador = calcRachasVallasPorArquero(matches);
    const prevRachasArq = prev.vallasRachaJugador || {};
    for (const [nombre, racha] of Object.entries(nextVallasRachaJugador)) {
      const hitoArq = VALLAS_JUGADOR_HITOS.find(h => racha >= h && (prevRachasArq[nombre] || 0) < h);
      if (hitoArq) {
        await sendPush(
          '🧤 Racha de vallas invictas',
          `${nombre} lleva ${racha} partidos consecutivos sin recibir goles — ${badge}`,
          `${SITE_URL}/#nido`
        );
      }
    }
  }

  await store.setJSON(stateKey, {
    matches: nextMatches, tablaPos: nextTablaPos, racha: nextRacha,
    jugadoresVistos: [...vistos], jugadoresConGol: [...conGol],
    vallasRachaJugador: nextVallasRachaJugador,
  });
}

// Categorías de El Nido con pill de ranking propio — mismas keys que
// RANK_METRICS en index.html (ver el comentario de getElNidoRankings en
// _matchPartidoData.js). Se filtran los valores en 0 antes de armar el
// Top 10: sin esto, una categoría donde casi nadie tiene nada (ej. Títulos
// para la mayoría del plantel) "avisaría" de entradas al Top 10 con 0,
// que no es un hito real.
const EL_NIDO_CATEGORIAS = [
  { key: 'pj', label: 'Partidos Jugados' },
  { key: 'goles', label: 'Goleadores' },
  { key: 'asist', label: 'Asistidores' },
  { key: 'gmas', label: 'G+A' },
  { key: 'titulos', label: 'Títulos' },
  { key: 'vallas', label: 'Vallas Invictas' },
  { key: 'promGol', label: 'Promedio de Goles' },
  { key: 'promAsist', label: 'Promedio de Asistencias' },
  { key: 'promGmas', label: 'Promedio de G+A' },
  { key: 'vallasProm', label: 'Promedio de Vallas Invictas' },
];
const EL_NIDO_SCOPES = [
  { key: 'general', label: 'General' },
  { key: 'a', label: 'Primera A' },
  { key: 'b', label: 'Primera B' },
];

function top10Nombres(list, key) {
  return [...list]
    .filter(p => (p[key] || 0) > 0)
    .sort((a, b) => (b[key] || 0) - (a[key] || 0))
    .slice(0, 10)
    .map(p => p.nombre);
}

// Cifra redonda de goles en el club — usa el TOTAL acumulado que ya trae
// rankings.general (career-wide, mismo campo "goles" que muestra El Nido),
// no un contador aparte: alcanza con comparar ese total contra el de la
// corrida anterior.
const GOLES_CLUB_HITOS = [10, 25, 50, 75, 100, 150, 200, 250];

// Top 10 / Top 3 de El Nido — General, Primera A y Primera B, por cada
// categoría. Corre independiente de checkTorneo (no depende de que se haya
// cerrado una fecha: los rankings pueden cambiar por una corrección de
// stats sin un partido nuevo de por medio).
async function checkElNido(store) {
  const rankings = await getElNidoRankings();
  const stateKey = 'estado-elnido';
  const prev = (await store.get(stateKey, { type: 'json' })) || { top10: {}, goles: {} };
  const nextTop10 = {};
  const nextGoles = {};

  for (const scope of EL_NIDO_SCOPES) {
    const list = rankings[scope.key] || [];
    for (const cat of EL_NIDO_CATEGORIAS) {
      const stateId = `${scope.key}-${cat.key}`;
      const top10 = top10Nombres(list, cat.key);
      nextTop10[stateId] = top10;

      // Primera corrida de esta combinación scope+categoría: no hay "antes"
      // con qué comparar — se guarda tal cual, sin avisar (si no, TODO el
      // Top 10 ya existente "entraría" de golpe la primera vez que corre).
      const prevTop10 = prev.top10[stateId];
      if (!prevTop10) continue;

      const yaEstaban = new Set(prevTop10);
      const nuevos = top10.filter(n => !yaEstaban.has(n));
      for (const nombre of nuevos) {
        await sendPush(
          '🏆 Entró al Top 10 de El Nido',
          `${nombre} entró al Top 10 de ${cat.label} — ${scope.label}`,
          `${SITE_URL}/#nido`
        );
      }
    }
  }

  for (const p of rankings.general) {
    if (!p.nombre) continue;
    nextGoles[p.nombre] = p.goles;
    // Primera vez que se ve a este jugador: sin base para comparar, no avisar.
    const prevGoles = prev.goles[p.nombre];
    if (prevGoles == null) continue;
    const hito = GOLES_CLUB_HITOS.find(h => p.goles >= h && prevGoles < h);
    if (hito) {
      await sendPush('🎯 Cifra redonda', `${p.nombre} llegó a ${p.goles} goles con el club`, `${SITE_URL}/#nido`);
    }
  }

  await store.setJSON(stateKey, { top10: nextTop10, goles: nextGoles });
}

async function runOnce() {
  const store = getStore(STORE_NAME);
  for (const torneo of Object.keys(TORNEO_CFG)) {
    try {
      await checkTorneo(store, torneo);
    } catch (e) {
      console.error(`push-scheduler: falló el chequeo de ${torneo}:`, e);
    }
  }
  try {
    await checkElNido(store);
  } catch (e) {
    console.error('push-scheduler: falló el chequeo de El Nido:', e);
  }
  return { statusCode: 200, body: 'ok' };
}

module.exports = { runOnce };
