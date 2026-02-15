const container = require("../../common/container.js");
const buildUsecases = require("../../common/build-usecases.js");

module.exports = buildUsecases(container, {
    findAll: require("./usecases/find-all.usecase.js"),
    create: require("./usecases/create.usecase.js"),
    findById: require("./usecases/find-by-id.usecase.js"),
    deleteById: require("./usecases/delete-by-id.usecase.js"),
    detail: require("./usecases/detailt.usecase.js"),
    pdf: require("./usecases/pdf.usecase.js"),
    submit: require("./usecases/submit.usecase.js"),
    xml: require("./usecases/xml.usecase.js"),
    sendEmail: require("./usecases/send-email.usecase.js"),
    sendWhatsapp: require("./usecases/send-whatsapp.usecase.js"),
});
