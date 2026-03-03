const container = require("../../common/container");

const init = require("./usecases/init.usecase");

class DashboardService {
    constructor(container) {
        this.init = init(container);
    }
}

module.exports = new DashboardService(container);