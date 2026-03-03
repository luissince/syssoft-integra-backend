const container = require("../../common/container");

const findAll = require("./usecases/find-all.usecase");
const create = require("./usecases/create.usecase");
const filterAll = require("./usecases/filter-all.usecase");
const cancel = require("./usecases/cancel.usecase");
const findById = require("./usecases/find-by-id.usecase");
const getDetailsById = require("./usecases/get-details-by-id.usecase");
const forSale = require("./usecases/for-sale.usecase");
const generatePdf = require("./usecases/generate-pdf.usecase");

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