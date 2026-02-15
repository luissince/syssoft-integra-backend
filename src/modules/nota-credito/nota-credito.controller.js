const notaCredito = require('./nota-credito.service');
const { sendSave, sendFile } = require('../../tools/Message');
const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

const findAll = makeController(notaCredito.findAll, (req) => req.query);

const create = asyncHandler(async (req, res) => {
    const data = await notaCredito.create(req.body);
    return sendSave(res, data);
});

const findById = makeController(notaCredito.findById, (req) => req.params);

const deleteById = makeController(notaCredito.deleteById, (req) => req.params);

const detail = makeController(notaCredito.detail, (req) => req.params);

const pdf = asyncHandler(async (req, res) => {
    const response = await notaCredito.pdf(req.params);
    return sendFile(res, response);
});

const submit = makeController(notaCredito.submit, (req) => req.params);

const xml = makeController(notaCredito.xml, (req) => req.params);

const sendEmail = makeController(notaCredito.sendEmail, (req) => req.params);

const sendWhatsapp = makeController(notaCredito.sendWhatsapp, (req) => req.params);

module.exports = {
    findAll,
    create,
    findById,
    deleteById,
    detail,
    pdf,
    submit,
    xml,
    sendEmail,
    sendWhatsapp,
};
