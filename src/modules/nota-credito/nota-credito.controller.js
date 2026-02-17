const notaCredito = require('./nota-credito.service');
const { sendSave, sendFile } = require('../../tools/Message');
const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

module.exports = {
    findAll: makeController(notaCredito.findAll, (req) => req.query),
    create: asyncHandler(async (req, res) => {
        const data = await notaCredito.create(req.body);
        return sendSave(res, data);
    }),
    findById: makeController(notaCredito.findById, (req) => req.params),
    deleteById: makeController(notaCredito.deleteById, (req) => req.params),
    detail: makeController(notaCredito.detail, (req) => req.params),
    pdf: asyncHandler(async (req, res) => {
        const response = await notaCredito.pdf(req.params);
        return sendFile(res, response);
    }),
    submit: makeController(notaCredito.submit, (req) => req.params),
    xml: makeController(notaCredito.xml, (req) => req.params),
    sendEmail: makeController(notaCredito.sendEmail, (req) => req.params),
    sendWhatsapp: makeController(notaCredito.sendWhatsapp, (req) => req.params),
};
