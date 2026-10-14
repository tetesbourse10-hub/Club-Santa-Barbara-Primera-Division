// Motor de push del seguimiento en vivo minuto a minuto — cada 1-2 min,
// TODOS los días (sin restricción de sábado, para cubrir también un
// partido entre semana), a diferencia de push-scheduler-sabado.js/-semana.js
// (que corren runOnce(), las 9 reglas "normales" de horario/citación/final/
// tabla/logros/rachas/El Nido). Ver el comentario completo de esto en
// scripts/_pushSchedulerCore.js, sección "Seguimiento en vivo minuto a
// minuto": runOnceVivo() arranca SIEMPRE con un chequeo barato (un fetch
// chico, separado del fetch grande de Fecha a Fecha) y no hace nada más si
// nadie activó el seguimiento a mano desde el tab "Control Vivo" del
// sheet — así esta corrida tan seguida no sale cara el resto del tiempo que
// no hay ningún partido en seguimiento.
//
// Cron `*/1 * * * *`: cada 1 minuto, todos los días.
const { schedule } = require('@netlify/functions');
const { runOnceVivo } = require('../../scripts/_pushSchedulerCore');

exports.handler = schedule('*/1 * * * *', runOnceVivo);
