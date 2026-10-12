const { makeController, asyncHandler } = require('../common/handlers/async.handler');
const guiaRemision = require('../services/guia-remision.service');
const { sendSave, sendFile } = require('../tools/Message');

module.exports = {
    list: makeController(guiaRemision.list, (req) => req),
    create: asyncHandler(async (req, res) => {
        const data = await guiaRemision.create(req);
        return sendSave(res, data);
    }),
    detail: makeController(guiaRemision.detail, (req) => req),
    id: makeController(guiaRemision.id, (req) => req),
    update: makeController(guiaRemision.update, (req) => req),
    cancel: makeController(guiaRemision.cancel, (req) => req),
    pdf: asyncHandler(async (req, res) => {
        const data = await guiaRemision.pdf(req);
        return sendFile(res, data);
    }),
    excel: makeController(guiaRemision.documentsPdfExcel, (req) => req),
};