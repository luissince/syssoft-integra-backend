const motivo = require('./motivo.service');
const { makeController } = require("../../tools/AsyncHandler");

module.exports = {
    options: makeController(motivo.options, (req) => req.query),
};
