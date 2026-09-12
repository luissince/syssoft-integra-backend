const { makeController } = require('../common/handlers/async.handler');
const tipoPedido = require('../services/tipo-pedido.service');

module.exports = {
    combo: makeController(tipoPedido.combo, (req) => req),
};