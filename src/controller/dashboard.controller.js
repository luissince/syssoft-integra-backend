
const dashboard = require("../services/dashboard.service");
const { sendSuccess, sendError } = require("../tools/Message");

async function init(req, res) {
    try {
        const data = await dashboard.init(req.query.idSucursal);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Dashboard/init", error);
    }
}

module.exports = {
    init,
};
