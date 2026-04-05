const container = require("../../common/container");

const findAll = require("./usecases/find-all");
const dashboard = require("./usecases/dashboard");
const getCdr = require("./usecases/get-cdr");
const getStatus = require("./usecases/get-status");
const getXml = require("./usecases/get-xml");
const sendEmail = require("./usecases/send-email");
const submitCreditNote = require("./usecases/submit-credit-note");
const submitDispatchAdvance = require("./usecases/submit-dispatch-advance");
const submitInvoice = require("./usecases/submit-invoice");
const voidInvoice = require("./usecases/void-invoice");
const voidReceipt = require("./usecases/void-receipt");
const voidReceiptCreditNote = require("./usecases/void-receipt-credit-note");
const voidInvoiceCreditNote = require("./usecases/void-invoice-credit-note");

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