const historial = require('./historial.service');
const { makeController } = require("../../tools/AsyncHandler");

module.exports = {
    findAll: makeController(historial.findAll, (req) => req.query),
};