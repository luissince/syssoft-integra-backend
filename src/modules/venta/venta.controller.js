const venta = require('./venta.service');
const { sendSave, sendFile } = require('../../tools/Message');
const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

const list = makeController(venta.list, (req) => req.query);

const filter = makeController(venta.filter, (req) => req.query);

const create = asyncHandler(async (req, res) => {
    const data = await venta.create(req.body);
    return sendSave(res, data);
});

const cancel = makeController(venta.cancel, (req) => req.query);

const detail = makeController(venta.detail, (req) => req.query);

const details = makeController(venta.details, (req) => req.query);

const forSale = makeController(venta.forSale, (req) => req.params);

const generatePdf = asyncHandler(async (req, res) => {
    const response = await venta.generatePdf(req.params);
    return sendFile(res, response);
});

module.exports = {
    list,
    filter,
    create,
    cancel,
    detail,
    details,
    forSale,
    generatePdf,
};
