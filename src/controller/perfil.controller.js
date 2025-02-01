
const perfil = require("../services/perfil.service");
const { ClientError } = require("../tools/Error");
const { sendSuccess, sendError, sendSave, sendClient } = require("../tools/Message");

async function list(req, res) {
    try {
        const data = await perfil.list(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Perfil/list", error);
    }
}

async function add(req, res) {
    try {
        const data = await perfil.add(req.body);
        return sendSave(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Perfil/add", error);
    }
}

async function id(req, res) {
    try {
        const data = await perfil.id(req.query.idPerfil);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se producto un error de servidor, intente nuevamente.", "Perfil/id", error);
    }
}

async function update(req, res) {
    try {
        const data = await perfil.update(req.body);
        return sendSave(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Perfil/update", error);
    }
}

async function remove(req, res) {
    try {
        const data = await perfil.remove(req.query.idPerfil);
        return sendSave(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Perfil/remove", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Perfil/remove", error);
        }
    }
}

async function combo(_, res) {
    try {
        const data = await perfil.combo();
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Perfil/combo", error);
    }
}

module.exports = {
    list,
    add,
    id,
    update,
    remove,
    combo,
};
