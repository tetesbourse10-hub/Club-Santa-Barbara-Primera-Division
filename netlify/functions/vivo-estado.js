// BUG REAL encontrado (reportado en un partido real: 15' después de
// arrancar el 2T de verdad, el reloj de la ficha seguía mostrando 45'):
// _vivo2TAnchorTs (index.html) ancla el reloj del 2T al momento en que ESE
// cliente lo ve por primera vez, guardado en sessionStorage — funciona bien
// mientras la pestaña sigue abierta, pero cualquier cliente que recién abre
// (o reabre) la ficha DESPUÉS de que el 2T ya arrancó hace rato no tiene
// forma de saber cuándo arrancó de verdad, así que ancla en "ahora" y el
// reloj queda pegado en 45'/46' aunque ya hayan pasado minutos reales.
// El único lugar que SÍ conoce el momento real es push-scheduler-vivo.js
// (corre cada minuto desde que se activa el seguimiento), que ya lo
// persiste en Netlify Blobs como `segundoTiempoInicioTs` (ver
// scripts/_pushSchedulerCore.js) para que el texto de las notificaciones
// sea preciso. Este endpoint expone ESE mismo dato de solo lectura para
// que el cliente lo use como ancla real en vez de inventar una propia.
const { getStore } = require('@netlify/blobs');
const { _blobsStoreOptions } = require('../../scripts/_pushSchedulerCore');

exports.handler = async (event) => {
  const torneo = String((event.queryStringParameters && event.queryStringParameters.torneo) || '').toLowerCase();
  if (torneo !== 'a' && torneo !== 'b') {
    return { statusCode: 400, body: JSON.stringify({ error: 'torneo debe ser "a" o "b"' }) };
  }
  try {
    const store = getStore(_blobsStoreOptions());
    const estado = (await store.get(`estado-vivo-${torneo}`, { type: 'json' })) || null;
    return {
      statusCode: 200,
      // no-store: este dato cambia en vivo, no sirve cachearlo ni un segundo.
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        fecha: estado ? estado.fecha : null,
        estadoVivo: estado ? estado.estadoVivo : null,
        segundoTiempoInicioTs: estado ? (estado.segundoTiempoInicioTs || null) : null,
      }),
    };
  } catch (e) {
    console.error('vivo-estado:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'error interno' }) };
  }
};
