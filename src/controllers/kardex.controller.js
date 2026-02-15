const kardex = require('../services/kardex.service');
const { sendSuccess, sendError } = require('../tools/Message');

async function list(req, res) {
    try {
        const data = await kardex.list(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Kardex/list", error);
    }
}

module.exports = {
    list
};