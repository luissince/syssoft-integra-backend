const container = require("../../common/container");

const options = require("./usecases/options");

class MotivoService {
    constructor(container) {
        this.options = options(container);
    }
}

module.exports = new MotivoService(container);