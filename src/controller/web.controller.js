const { makeController, asyncHandler } = require('../common/handlers/async.handler');
const web = require('../services/web.service');
const { sendSave } = require('../tools/Message');

module.exports = {
    id: makeController(web.id, (req) => req),
    create: asyncHandler(async (req, res) => {
        const data = await web.create(req);
        return sendSave(res, data);
    }),
};