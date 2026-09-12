// Motor de notificaciones push automáticas — corre solo, cada 30 minutos
// (Netlify Scheduled Function, ver `schedule(...)` al final), sin que nadie
// tenga que apretar nada. Reusa el mismo getAllMatches() que ya usa la ficha
// de partido (scripts/_matchPartidoData.js) para no duplicar la lógica de
// fetch/parseo de Fecha a Fecha en una segunda copia a mano.
//
// Cómo detecta "algo pasó": guarda en Netlify Blobs una foto del estado de
// cada torneo (qué partidos tienen resultado, hora, plantel citado) en cada
// corrida, y la compara contra la foto de la corrida anterior. Un campo que
// pasó de vacío a con dato = dispara el push correspondiente. Así cada regla
// nueva que se agregue después es, en el fondo, "¿qué campo cambió", no una
// arquitectura aparte por regla.
//
// Reglas ya implementadas (ver conversación por la lista completa de 9):
//   1. Horario de partido confirmado
//   2. Citación y 11 probable (plantel cargado)
//   3. Final del partido (resultado cargado)
//   4. Tabla de posiciones + Próximo rival (combinados, mismo trigger que 3)
//   5. Racha en juego (invicto, al cruzar un hito redondo: 5/10/15/...)
// El resto (Top 10 de El Nido, logros, recordatorio por reloj) se suman en
// tandas siguientes, sobre esta misma base.
const { schedule } = require('@netlify/functions');
const { getStore } = require('@netlify/blobs');
const { getAllMatches, getTabla, SITE_URL, TORNEO_CFG } = require('../../scripts/_matchPartidoData');

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

async function checkTorneo(store, torneo) {
  const data = await getAllMatches(torneo);
  if (!data) return;
  const { matches } = data;
  const badge = TORNEO_CFG[torneo].badge;
  const stateKey = `estado-${torneo}`;
  const prev = (await store.get(stateKey, { type: 'json' })) || { matches: {}, tablaPos: null, racha: 0 };
  const nextMatches = {};
  let huboFinal = false;

  for (const m of matches) {
    const fecha = String(m.fecha);
    const prevM = prev.matches[fecha] || null;
    const curr = snapshotOf(m);
    nextMatches[fecha] = curr;

    // Primera corrida de un partido nunca visto antes: no hay "antes" con
    // qué comparar — se guarda tal cual está ahora, sin disparar nada. Si
    // no hiciéramos esto, el primer partido cargado en el sheet dispararía
    // sus 3 avisos de golpe en la primera corrida después del deploy.
    if (!prevM) continue;

    const url = `${SITE_URL}/#partido/${torneo}/${encodeURIComponent(fecha)}`;

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
    }
  }

  // Tabla de posiciones + Próximo rival — combinados en un solo push (mismo
  // trigger: se cerró una fecha), en vez de 2 avisos separados por lo mismo.
  let nextTablaPos = prev.tablaPos;
  let nextRacha = prev.racha || 0;
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
  }

  await store.setJSON(stateKey, { matches: nextMatches, tablaPos: nextTablaPos, racha: nextRacha });
}

async function handler() {
  const store = getStore(STORE_NAME);
  for (const torneo of Object.keys(TORNEO_CFG)) {
    try {
      await checkTorneo(store, torneo);
    } catch (e) {
      console.error(`push-scheduler: falló el chequeo de ${torneo}:`, e);
    }
  }
  return { statusCode: 200, body: 'ok' };
}

// Cada 30 min — suficientemente seguido para que un aviso llegue con
// sentido (recién cargado el dato), sin ser tan frecuente como para pesar
// en el cupo de créditos de Netlify.
exports.handler = schedule('*/30 * * * *', handler);
