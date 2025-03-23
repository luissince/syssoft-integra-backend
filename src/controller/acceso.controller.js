const acceso = require('../services/acceso.service');
const { sendSuccess, sendError } = require('../tools/Message');

async function accesos(req, res) {
    try {
        const data = await acceso.accesos(req.params.idPerfil);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Acceso/accesos", error);
    }
}

async function save(req, res) {
    try {
        const data = await acceso.save(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Acceso/save", error);
    }
}

async function update(req, res) {
    try {
        const data = await acceso.update(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Acceso/update", error);
    }
}

module.exports = {
    accesos,
    save,
    update
};