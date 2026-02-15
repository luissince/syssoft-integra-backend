const dashboard = require('./dashboard.service');
const { makeController } = require("../../tools/AsyncHandler");

const init = makeController(dashboard.init, (req) => req.query);

module.exports = {
    init,
}