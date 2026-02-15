const container = require("../../common/container");
const buildUsecases = require("../../common/build-usecases");

module.exports = buildUsecases(container, {
    list: require("./usecases/list.usecase"),
    create: require("./usecases/create.usecase"),
    filter: require("./usecases/filter.usecase"),
    cancel: require("./usecases/cancel.usecase"),
    detail: require("./usecases/detail.usecase"),
    details: require("./usecases/details.usecase"),
    forSale: require("./usecases/for-sale.usecase"),
    generatePdf: require("./usecases/generate-pdf.usecase"),
});
