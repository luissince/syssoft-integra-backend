const sunat = require('./sunat.service');
const { sendFile } = require('../../tools/Message');
const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

module.exports = {
    findAll: makeController(sunat.findAll, (req) => req.query),
    dashboard: makeController(sunat.dashboard, (req) => req.query),
    getCdr: makeController(sunat.getCdr, (req) => req.params),
    getStatus: makeController(sunat.getStatus, (req) => req.params),
    getXml: asyncHandler(async (req, res) => {
        const response = await sunat.getXml(req.params);
        return sendFile(res, response);
    }),
    sendEmail: makeController(sunat.sendEmail, (req) => req.params),
    submitCreditNote: makeController(sunat.submitCreditNote, (req) => req.params),
    submitDispatchAdvance: makeController(sunat.submitDispatchAdvance, (req) => req.params),
    submitInvoice: makeController(sunat.submitInvoice, (req) => req.params),
    voidInvoice: makeController(sunat.voidInvoice, (req) => req.params),
    voidReceipt: makeController(sunat.voidReceipt, (req) => req.params),
    voidReceiptCreditNote: makeController(sunat.voidReceiptCreditNote, (req) => req.params),
    voidInvoiceCreditNote: makeController(sunat.voidInvoiceCreditNote, (req) => req.params),
};
