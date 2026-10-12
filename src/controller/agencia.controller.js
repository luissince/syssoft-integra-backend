const { makeController } = require('../common/handlers/async.handler');
const agencia = require('../services/agencia.service');

module.exports = {
    combo: makeController(agencia.combo, (req) => req),
};