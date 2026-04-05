const container = require("../../common/container");

const init = require("./usecases/init");

class DashboardService {
    constructor(container) {
        this.init = init(container);
    }
}

module.exports = new DashboardService(container);