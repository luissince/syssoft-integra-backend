const ajuste = require('../services/ajuste.service');
const { ClientError } = require('../tools/Error');
const { sendSuccess, sendError, sendClient } = require('../tools/Message');

async function list(req, res) {
    try {
        const data = await ajuste.list(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Ajuste/list", error);
    }
}

async function detail(req, res) {
    try {
        const data = await ajuste.detail(req.query.idAjuste);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Ajuste/detail", error);
    }
}

async function create(req, res) {
    try {
        const data = await ajuste.create(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Ajuste/create", error);
        }
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Ajuste/create", error);
    }
}

async function cancel(req, res) {
    try {
        const data = await ajuste.cancel(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Ajuste/cancel", error);
        }
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Ajuste/cancel", error);
    }
}

module.exports = {
    list,
    detail,
    create,
    cancel
};