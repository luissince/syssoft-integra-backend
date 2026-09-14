const { makeController } = require('../common/handlers/async.handler');
const firebase = require('../services/firebase.service');

module.exports = {
    files: makeController(firebase.files, (req) => req),
};