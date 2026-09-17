// Motor de push, corrida "en vivo" — cada 5 minutos, SOLO los sábados (día
// de partido de ambos planteles). El resto de la semana casi no hay nada
// urgente (cargar un horario entre semana puede esperar), así que ese
// tráfico va por push-scheduler-semana.js, mucho más espaciado — ver el
// comentario completo de las 9 reglas en scripts/_pushSchedulerCore.js.
//
// Cron `*/5 * * * 6`: cada 5 min, día de semana 6 (sábado). Con esto, la
// función ni siquiera se INVOCA el resto de la semana (no es "se ejecuta
// igual pero no hace nada" — Netlify directamente no la dispara esos días),
// así que no compite por créditos fuera del día que realmente hace falta.
const { schedule } = require('@netlify/functions');
const { runOnce } = require('../../scripts/_pushSchedulerCore');

exports.handler = schedule('*/5 * * * 6', runOnce);
