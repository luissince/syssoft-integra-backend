const container = require("../../common/container.js");

const findAll = require("./usecases/find-all.js");

class HistorialService {
    constructor(container) {
        this.findAll = findAll(container);
    }
}

module.exports = new HistorialService(container);