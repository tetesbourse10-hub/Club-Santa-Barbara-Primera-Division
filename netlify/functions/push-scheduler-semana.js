// Motor de push, corrida "tranquila" — cada 2 horas, domingo a viernes (el
// sábado, día de partido, va por push-scheduler-sabado.js, mucho más
// seguido). Alcanza para que un horario/citación cargados entre semana se
// avisen el mismo día, sin gastar créditos de más en un día sin partido —
// ver el comentario completo de las 9 reglas en
// scripts/_pushSchedulerCore.js.
//
// Cron `0 */2 * * 0-5`: en punto, cada 2 horas, días de semana 0 a 5
// (domingo a viernes — sábado es el 6, cubierto aparte).
const { schedule } = require('@netlify/functions');
const { runOnce } = require('../../scripts/_pushSchedulerCore');

exports.handler = schedule('0 */2 * * 0-5', runOnce);
