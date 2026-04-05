const container = require("../../common/container.js");

const findAll = require("./usecases/find-all");
const create = require("./usecases/create");
const findById = require("./usecases/find-by-id");
const deleteById = require("./usecases/delete-by-id");
const detail = require("./usecases/detail");
const pdf = require("./usecases/pdf");
const submit = require("./usecases/submit");
const xml = require("./usecases/xml");
const sendEmail = require("./usecases/send-email");
const sendWhatsapp = require("./usecases/send-whatsapp");


class NotaCreditoService {
    constructor(container) {
        this.findAll = findAll(container);
        this.create = create(container);
        this.findById = findById(container);
        this.deleteById = deleteById(container);
        this.detail = detail(container);
        this.pdf = pdf(container);
        this.submit = submit(container);
        this.xml = xml(container);
        this.sendEmail = sendEmail(container);
        this.sendWhatsapp = sendWhatsapp(container);
    }
}

module.exports = new NotaCreditoService(container);