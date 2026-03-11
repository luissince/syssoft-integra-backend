const kardex = require('../services/kardex.service');
const { sendSuccess } = require('../tools/Message');

async function list(req, res) {
    const data = await kardex.list(req.query);
    return sendSuccess(res, data);
}

async function listarDepreciacion(req, res) {
    const data = await kardex.listDepreciacion(req.body);
    return sendSuccess(res, data);
}

async function detalleDepreciacion(req, res) {
    const data = await kardex.detailtDepreciacion(req.body);
    return sendSuccess(res, data);
}

async function createDepreciacion(req, res) {
    const data = await kardex.createDepreciacion(req.query);
    return sendSuccess(res, data);
}

module.exports = {
    list,
    detalleDepreciacion,
    createDepreciacion,
    listarDepreciacion,
};