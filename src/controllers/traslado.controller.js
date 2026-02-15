const traslado = require('../services/traslado.service');
const { sendSuccess, sendError } = require('../tools/Message');

async function list(req, res) {
    try {
        const data = await traslado.list(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Traslado/list", error);
    }
}
async function detail(req, res) {
    try {
        const data = await traslado.detail(req.query.idTraslado);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Traslado/detail", error);
    }
}

async function create(req, res) {
    try {
        const data = await traslado.create(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Traslado/create", error);
    }
}

async function cancel(req, res) {
    try {
        const data = await traslado.cancel(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Traslado/cancel", error);
    }
}

module.exports = {
    list,
    detail,
    create,
    cancel,
};