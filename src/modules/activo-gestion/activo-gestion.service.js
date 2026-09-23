
const container = require("../../common/container");

const create = require("./usecases/create");
const devolver = require("./usecases/devolver");
const deleteById = require("./usecases/delete-by-id");
const findAll = require("./usecases/find-all");
const findById = require("./usecases/find-by-id");
const update = require("./usecases/update");
const reportAsignacion = require("./usecases/report-asignacion");
const excelAsignacion = require("./usecases/excel-asignacion");

class ActivoGestionService {
    constructor(container) {
        this.create = create(container);
        this.devolver = devolver(container);
        this.deleteById = deleteById(container);
        this.findAll = findAll(container);
        this.findById = findById(container);
        this.update = update(container);
        this.reportAsignacion = reportAsignacion(container);
        this.excelAsignacion = excelAsignacion(container);
    }
}

module.exports = new ActivoGestionService(container);