
const usuario = require("../services/usuario.service");
const { sendSuccess, sendError, sendSave, sendClient } = require("../tools/Message");
const { ClientError } = require("../tools/Error");

async function list(req, res) {
    try {
        const data = await usuario.list(req.query);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/list", error);
    }
}

async function add(req, res) {
    try {
        const data = await usuario.add(req.body);
        return sendSave(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/add", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/add", error);
        }
    }
}

async function update(req, res) {
    try {
        const data = await usuario.update(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/update", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/update", error);
        }
    }
}

async function remove(req, res) {
    try {
        const data = await usuario.remove(req.query.idUsuario);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/delete", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/delete", error);
        }
    }
}

async function reset(req, res) {
    try {
        const data = await usuario.reset(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/reset", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/reset", error);
        }
    }
}

async function id(req, res) {
    try {
        const data = await usuario.id(req.query.idUsuario);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/reset", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/reset", error);
        }
    }
}

async function combo(_, res) {
    try {
        const data = await usuario.combo();
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/combo", error);
    }
}

async function createSession(req, res) {
    try {
        const data = await usuario.createSession(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/createSession", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/createSession", error);
        }
    }
}

async function validToken(req, res) {
    try {
        const data = await usuario.validToken(req.dataToken.idUsuario);
        return sendSuccess(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Usuario/validToken", error);
        } else {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/validToken", error);
        }
    }
}

module.exports = {
    list,
    add,
    update,
    remove,
    reset,
    id,
    combo,
    createSession,
    validToken,
};
