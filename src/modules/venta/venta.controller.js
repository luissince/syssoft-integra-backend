const venta = require('./venta.service');
const { sendSave, sendFile } = require('../../tools/Message');
const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

module.exports = {
    findAll: makeController(venta.findAll, (req) => req.query),
    filterAll: makeController(venta.filterAll, (req) => req.query),
    create: asyncHandler(async (req, res) => {
        const data = await venta.create(req.body);
        return sendSave(res, data);
    }),
    cancel: makeController(venta.cancel, (req) => req.query),
    findById: makeController(venta.findById, (req) => req.params),
    getDetailsById: makeController(venta.getDetailsById, (req) => req.params),
    forSale: makeController(venta.forSale, (req) => req.params),
    generatePdf: asyncHandler(async (req, res) => {
        const response = await venta.generatePdf(req.params);
        return sendFile(res, response);
    }),
};
