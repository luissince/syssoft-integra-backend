const express = require('express');
const router = express.Router();

const Compra = require('../services/Compra');
const { default: axios } = require('axios');
const { sendFile, sendError } = require('../tools/Message');

const compra = new Compra();

router.get('/list', async (req, res) => await compra.list(req, res));

router.get('/detail', async (req, res) => await compra.detail(req, res));

router.post('/create', async (req, res) => await compra.create(req, res));

router.delete('/cancel', async (req, res) => await compra.cancel(req, res));

router.get('/list/accounts/payable', async (req, res) => await compra.listAccountsPayable(req, res));

router.get("/detail/accounts/payable", async (req, res) => await compra.detailAccountsPayable(req, res));

router.post("/create/accounts/payable", async (req, res) => await compra.createAccountsPayable(req, res));

router.delete("/cancel/accounts/payable", async (req, res) => await compra.cancelAccountsPayable(req, res));

router.get("/dashboard", async (req, res) => await compra.dashboard(req, res));

router.get("/documents/pdf/invoices/:idCompra/:size", async (req, res) => {
    try {
        const data = await compra.documentsPdfInvoices(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/purchase/pdf/invoices`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/account/payable/:idPlazo/:idCompra/:size", async (req, res) => await compra.documentsPdfAccountsPayable(req, res));

router.get("/documents/pdf/reports", async (req, res) => await compra.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await compra.documentsPdfExcel(req, res));

module.exports = router;