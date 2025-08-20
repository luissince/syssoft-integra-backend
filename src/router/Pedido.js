const express = require('express');
const router = express.Router();
const Pedido = require('../services/Pedido');
const { sendError, sendFile } = require('../tools/Message');
const { default: axios } = require('axios');

const pedido = new Pedido();

router.get('/list', async (req, res) => await pedido.list(req, res));

router.get('/id/:idPedido', async (req, res) => await pedido.id(req, res));

router.get('/detail/:idPedido', async (req, res) => await pedido.detail(req, res));

router.get('/for-sale', async (req, res) => await pedido.forSale(req, res));

router.post('/create', async (req, res) => await pedido.create(req, res));

router.post('/create/web', async (req, res) => await pedido.createWeb(req, res));

router.put('/update', async (req, res) => await pedido.update(req, res));

router.delete('/cancel', async (req, res) => await pedido.cancel(req, res));

router.get("/documents/pdf/invoices/:idPedido/:size", async (req, res) => {
    try {
        const data = await pedido.documentsPdfInvoicesOrList(req, res);

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
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/lists/:idPedido", async (req, res) => {
    try {
        const data = await pedido.documentsPdfInvoicesOrList(req, res);

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
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfList", error);
    }
});

router.get("/documents/pdf/reports", async (req, res) => await pedido.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await pedido.documentsPdfExcel(req, res));

module.exports = router;