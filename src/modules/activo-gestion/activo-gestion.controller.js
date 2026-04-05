
const area = require("./activo-gestion.service");
const { makeController, asyncHandler } = require("../../tools/AsyncHandler");
const { sendSave } = require("../../tools/Message");

module.exports = {
    create: asyncHandler(async (req, res) => {
        const data = await area.create(req.body);
        return sendSave(res, data);
    }),
    deleteById: makeController(area.deleteById, (req) => req.params),
    findAll: makeController(area.findAll, (req) => req.query),
    findById: makeController(area.findById, (req) => req.params),
    update: asyncHandler(async (req, res) => {
        const data = await area.update(req.body);
        return sendSave(res, data);
    }),
};
