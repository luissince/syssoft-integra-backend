
const gestion = require("./activo-gestion.service");
const { makeController, asyncHandler } = require("../../tools/AsyncHandler");
const { sendSave } = require("../../tools/Message");

module.exports = {
    create: asyncHandler(async (req, res) => {
        const data = await gestion.create(req.body);
        return sendSave(res, data);
    }),
    devolver: asyncHandler(async(req, res)  => {
        const data = await gestion.devolver(req.body);
        return sendSave(res, data);
    } ),
    deleteById: makeController(gestion.deleteById, (req) => req.params),
    findAll: makeController(gestion.findAll, (req) => req.query),
    findById: makeController(gestion.findById, (req) => req.params),
    update: asyncHandler(async (req, res) => {
        const data = await gestion.update(req.body);
        return sendSave(res, data);
    }),
};
