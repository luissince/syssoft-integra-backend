const venta = require('./venta.service');
const { sendSave, sendFile } = require('../../tools/Message');
const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

module.exports = {
    list: makeController(venta.list, (req) => req.query),
    filter: makeController(venta.filter, (req) => req.query),
    create: asyncHandler(async (req, res) => {
        const data = await venta.create(req.body);
        return sendSave(res, data);
    }),
    cancel: makeController(venta.cancel, (req) => req.query),
    detail: makeController(venta.detail, (req) => req.query),
    details: makeController(venta.details, (req) => req.query),
    forSale: makeController(venta.forSale, (req) => req.params),
    generatePdf: asyncHandler(async (req, res) => {
        const response = await venta.generatePdf(req.params);
        return sendFile(res, response);
    }),
};
