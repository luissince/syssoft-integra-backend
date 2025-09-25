const express = require('express');
const router = express.Router();
const Factura = require('../services/Factura');
const { default: axios } = require('axios');
const { sendFile, sendError } = require('../tools/Message');

const factura = new Factura();

router.get("/list", async (req, res) => await factura.list(req, res));

router.get("/filtrar", async (req, res) => await factura.filtrar(req, res));

router.post("/create", async (req, res) => await factura.create(req, res));

router.delete("/cancel", async (req, res) => await factura.cancel(req, res));

router.get("/detail", async (req, res) => await factura.detail(req, res));

router.get("/detail/only", async (req, res) => await factura.detailOnly(req, res));

router.get("/detail/venta", async (req, res) => await factura.detailVenta(req, res));

router.get("/list/accounts/receivable", async (req, res) => await factura.listAccountsReceivable(req, res));

router.get("/detail/accounts/receivable", async (req, res) => await factura.detailAccountsReceivable(req, res));

router.post("/create/accounts/receivable", async (req, res) => await factura.createAccountsReceivable(req, res));

router.delete("/cancel/accounts/receivable", async (req, res) => await factura.cancelAccountsReceivable(req, res));

router.get("/dashboard", async (req, res) => await factura.dashboard(req, res));

router.get("/documents/pdf/invoices/:idVenta/:size/:outputType", async (req, res) => {
    try {
        const data = await factura.documentsPdfInvoices(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/sale/pdf/invoices`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/account/receivable/:idCuota/:idVenta/:size", async (req, res) => await factura.documentsPdfAccountsReceivable(req, res));

router.get("/documents/pdf/reports", async (req, res) => await factura.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await factura.documentsPdfExcel(req, res));

module.exports = router;