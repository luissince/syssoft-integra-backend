
const kardex = require("./kardex.service");
const { makeController } = require("../../tools/AsyncHandler");

module.exports = {
    findAll: makeController(kardex.findAll, (req) => req.query),
    metricsDepreciations: makeController(kardex.metricsDepreciations, (req) => req.query),
    findAllAsset: makeController(kardex.findAllAsset, (req) => req.query),
    findAllDepreciations: makeController(kardex.findAllDepreciations, (req) => req.body),
    createDepreciations: makeController(kardex.createDepreciations, (req) => req.body),
    detailDepreciations: makeController(kardex.detailDepreciations, (req) => req.body),
};
