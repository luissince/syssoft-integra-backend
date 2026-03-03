const container = require("../../common/container");

const findAll = require("./usecases/find-all.usecase");
const dashboard = require("./usecases/dashboard.usecase");
const getCdr = require("./usecases/get-cdr.usecase");
const getStatus = require("./usecases/get-status.usecase");
const getXml = require("./usecases/get-xml.usecase");
const sendEmail = require("./usecases/send-email.usecase");
const submitCreditNote = require("./usecases/submit-credit-note.usecase");
const submitDispatchAdvance = require("./usecases/submit-dispatch-advance.usecase");
const submitInvoice = require("./usecases/submit-invoice.usecase");
const voidInvoice = require("./usecases/void-invoice.usecase");
const voidReceipt = require("./usecases/void-receipt.usecase");
const voidReceiptCreditNote = require("./usecases/void-receipt-credit-note.usecase");
const voidInvoiceCreditNote = require("./usecases/void-invoice-credit-note.usecase");

class SunatService {
    constructor(container) {
        this.findAll = findAll(container);
        this.dashboard = dashboard(container);
        this.getCdr = getCdr(container);
        this.getStatus = getStatus(container);
        this.getXml = getXml(container);
        this.sendEmail = sendEmail(container);
        this.submitCreditNote = submitCreditNote(container);
        this.submitDispatchAdvance = submitDispatchAdvance(container);
        this.submitInvoice = submitInvoice(container);
        this.voidInvoice = voidInvoice(container);
        this.voidReceipt = voidReceipt(container);
        this.voidReceiptCreditNote = voidReceiptCreditNote(container);
        this.voidInvoiceCreditNote = voidInvoiceCreditNote(container);
    }
}

module.exports = new SunatService(container);