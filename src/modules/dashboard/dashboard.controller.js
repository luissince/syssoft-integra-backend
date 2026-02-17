const dashboard = require('./dashboard.service');
const { makeController } = require("../../tools/AsyncHandler");

module.exports = {
    init: makeController(dashboard.init, (req) => req.query),
}