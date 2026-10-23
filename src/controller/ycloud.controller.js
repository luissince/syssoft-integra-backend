const { makeController } = require('../common/handlers/async.handler');
const ycloud = require('../services/ycloud.service');

module.exports = {
    text: makeController(ycloud.sendText, (req) => req),
    document: makeController(ycloud.sendDocument, (req) => req),
};