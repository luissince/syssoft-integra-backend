const container = require("../../common/container");

const findAll = require("./usecases/find-all");
const create = require("./usecases/create");
const filterAll = require("./usecases/filter-all");
const cancel = require("./usecases/cancel");
const findById = require("./usecases/find-by-id");
const getDetailsById = require("./usecases/get-details-by-id");
const forSale = require("./usecases/for-sale");
const generatePdf = require("./usecases/generate-pdf");

class VentaService {
    constructor(container) {
        this.findAll = findAll(container);
        this.create = create(container);
        this.filterAll = filterAll(container);
        this.cancel = cancel(container);
        this.findById = findById(container);
        this.getDetailsById = getDetailsById(container);
        this.forSale = forSale(container);
        this.generatePdf = generatePdf(container);
    }
}

module.exports = new VentaService(container);