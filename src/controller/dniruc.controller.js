const { makeController } = require('../common/handlers/async.handler');
const dniruc = require('../services/dniruc.service');

module.exports = {
    dni: makeController(dniruc.dni, (req) => req),
    ruc: makeController(dniruc.ruc, (req) => req),
};