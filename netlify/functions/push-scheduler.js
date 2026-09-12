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
// Reglas de esta primera tanda (las 3 más simples del plan, ver conversación):
//   1. Horario de partido confirmado
//   2. Citación y 11 probable (plantel cargado)
//   3. Final del partido (resultado cargado)
// El resto de las 9 reglas acordadas (tabla de posiciones, racha, Top 10 de
// El Nido, logros, recordatorio por reloj) se suman en tandas siguientes,
// sobre esta misma base.
const { schedule } = require('@netlify/functions');
const { getStore } = require('@netlify/blobs');
const { getAllMatches, SITE_URL, TORNEO_CFG } = require('../../scripts/_matchPartidoData');

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

async function checkTorneo(store, torneo) {
  const data = await getAllMatches(torneo);
  if (!data) return;
  const { matches } = data;
  const badge = TORNEO_CFG[torneo].badge;
  const prevKey = `matches-${torneo}`;
  const prev = (await store.get(prevKey, { type: 'json' })) || {};
  const next = {};

  for (const m of matches) {
    const fecha = String(m.fecha);
    const prevM = prev[fecha] || null;
    const curr = snapshotOf(m);
    next[fecha] = curr;

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
    }
  }

  await store.setJSON(prevKey, next);
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
