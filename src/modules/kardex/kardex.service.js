
const container = require("../../common/container");

const findAll = require("./usecases/find-all");
const metricsDepreciations = require("./usecases/metrics-depreciations");
const findAllAsset = require("./usecases/find-all-asset");
const findAllDepreciations = require("./usecases/find-all-depreciations");
const createDepreciations = require("./usecases/create-depreciations");
const detailDepreciations = require("./usecases/detail-depreciations");

class KardexService {
    constructor(container) {
        this.findAll = findAll(container);
        this.metricsDepreciations = metricsDepreciations(container);
        this.findAllAsset = findAllAsset(container);
        this.findAllDepreciations = findAllDepreciations(container);
        this.createDepreciations = createDepreciations(container);
        this.detailDepreciations = detailDepreciations(container);
    }
}

module.exports = new KardexService(container);