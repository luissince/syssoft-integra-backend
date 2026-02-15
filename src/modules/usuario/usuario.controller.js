
const usuario = require("./usuario.service");
const { makeController } = require("../../tools/AsyncHandler");
const { sendSave } = require("../../tools/Message");

const findAll = makeController(usuario.findAll, (req) => req.query);

const create = makeController(usuario.create, (req) => req.body);

const update = makeController(async (req, res) => {
    const result = await usuario.update(req.params.idUsuario, req.body);
    return sendSave(res, result);
});

const deleteById = makeController(usuario.deleteById, (req) => req.query.idUsuario);

const resetPassword = makeController(usuario.resetPassword, (req) => req.body);

const findById = makeController(usuario.findById, (req) => req.params.idUsuario);

const getSelectOptions = makeController(usuario.getSelectOptions, (req) => req.query);

const authenticate = makeController(usuario.authenticate, (req) => req.body);

const refreshToken = makeController(usuario.refreshToken, (req) => req.dataToken.idUsuario);

module.exports = {
    findAll,
    create,
    update,
    deleteById,
    resetPassword,
    findById,
    getSelectOptions,
    authenticate,
    refreshToken,
};
