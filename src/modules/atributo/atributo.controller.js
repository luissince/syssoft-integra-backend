const cargo = require("./atributo.service");
const { makeController, asyncHandler } = require("../../tools/AsyncHandler");
const { sendSave } = require("../../tools/Message");

module.exports = {
    create: asyncHandler (async (req, res) => {
        const data = await cargo.create(req.body);
        return sendSave(res, data);
    }),
    deleteById: makeController(cargo.deleteById, (req) => req.params),
    findAll: makeController(cargo.findAll, (req) => req.query),
    findById: makeController(cargo.findById, (req) => req.params),
    options: makeController(cargo.options, (req) => req.params),
    update: asyncHandler(async (req, res) => {
        const data = await cargo.update(req.body);
        return sendSave(res, data);
    }),
};
