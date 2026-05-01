
const usuario = require("./usuario.service");
const { makeController } = require("../../tools/AsyncHandler");
const { sendSave } = require("../../tools/Message");

module.exports = {
    findAll: makeController(usuario.findAll, (req) => req.query),
    create: makeController(usuario.create, (req) => req.body),
    update: makeController(async (req, res) => {
        const result = await usuario.update(req.params.idUsuario, req.body);
        return sendSave(res, result);
    }),
    deleteById: makeController(usuario.deleteById, (req) => req.params.idUsuario),
    resetPassword: makeController(usuario.resetPassword, (req) => req.body),
    findById: makeController(usuario.findById, (req) => req.params.idUsuario),
    getSelectOptions: makeController(usuario.getSelectOptions, (req) => req.query),
    authenticate: makeController(usuario.authenticate, (req) => req.body),
    refreshToken: makeController(usuario.refreshToken, (req) => req.dataToken.idUsuario),
};
