const { makeController, asyncHandler } = require('../common/handlers/async.handler');
const traslado = require('../services/traslado.service');
const { sendSave, sendFile } = require('../tools/Message');

module.exports = {
    list: makeController(traslado.list, (req) => req),
    detail: makeController(traslado.detail, (req) => req),
    create: asyncHandler(async (req, res) => {
        const data = await traslado.create(req);
        return sendSave(res, data);
    }),
    cancel: makeController(traslado.cancel, (req) => req),
    pdf: asyncHandler(async (req, res) =>{
        const data = await traslado.pdf(req);
        return sendFile(res, data);
    }),
    shippingGuide: makeController(traslado.shippingGuide, (req) => req),

    shippingGuideDetails: makeController(traslado.shippingGuideDetails, (req) => req),
};