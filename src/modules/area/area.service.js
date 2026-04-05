
const container = require("../../common/container");

const create = require("./usecases/create");
const deleteById = require("./usecases/delete-by-id");
const findAll = require("./usecases/find-all");
const findById = require("./usecases/find-by-id");
const options = require("./usecases/options");
const update = require("./usecases/update");

class AreaService {
    constructor(container) {
        this.create = create(container);
        this.deleteById = deleteById(container);
        this.findAll = findAll(container);
        this.findById = findById(container);
        this.options = options(container);
        this.update = update(container);
    }
}

module.exports = new AreaService(container);