const { makeController } = require('../common/handlers/async.handler');
const plazo = require('../services/plazo.service');

module.exports = {
    combo: makeController(plazo.combo, (req) => req),
};