const express = require('express');
const router = express.Router();
const OrdenCompra = require('../services/OrdenCompra');
const { sendError, sendFile } = require('../tools/Message');
const { default: axios } = require('axios');

require('dotenv').config();
const ordenCompra = new OrdenCompra();

router.get('/list', async (req, res) => await ordenCompra.list(req, res));

router.get('/id', async (req, res) => await ordenCompra.id(req, res));

router.get('/detail', async (req, res) => await ordenCompra.detail(req, res));

router.get('/for-purchase', async (req, res) => await ordenCompra.forPurchase(req, res));

router.post('/create', async (req, res) => await ordenCompra.create(req, res));

router.put('/update', async (req, res) => await ordenCompra.update(req, res));

router.delete('/cancel', async (req, res) => await ordenCompra.cancel(req, res));

router.get("/documents/pdf/invoices/:idOrdenCompra/:size", async (req, res) => {
    try {
        const data = await ordenCompra.documentsPdfInvoicesOrList(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/order/pdf/invoices`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/lists/:idOrdenCompra", async (req, res) => {
    try {
        const data = await ordenCompra.documentsPdfInvoicesOrList(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/order/pdf/lists`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/documentsPdfList", error);
    }
});

router.get("/documents/pdf/reports", async (req, res) => await ordenCompra.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await ordenCompra.documentsPdfExcel(req, res));

module.exports = router;