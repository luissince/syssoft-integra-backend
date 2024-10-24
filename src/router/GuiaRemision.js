const express = require('express');
const router = express.Router();
const GuiaRemision = require('../services/GuiaRemision');
const { default: axios } = require('axios');
const { sendFile, sendError } = require('../tools/Message');

require('dotenv').config();
const guiaRemision = new GuiaRemision();

router.get('/list', async (req, res) => await guiaRemision.list(req, res));

router.get('/id', async (req, res) => await guiaRemision.id(req, res));

router.get('/detail', async (req, res) => await guiaRemision.detail(req, res));

router.get('/detail/update', async (req, res) => await guiaRemision.detailUpdate(req, res));

router.post('/create', async (req, res) => await guiaRemision.create(req, res));

router.put('/update', async (req, res) => await guiaRemision.update(req, res));

router.delete('/cancel', async (req, res) => await guiaRemision.cancel(req, res));

router.get("/documents/pdf/invoices/:idGuiaRemision/:size", async (req, res) => {
    try {
        const data = await guiaRemision.documentsPdfInvoices(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/dispatch-guide/pdf/invoices`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/reports", async (req, res) => await guiaRemision.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await guiaRemision.documentsPdfExcel(req, res));

module.exports = router;