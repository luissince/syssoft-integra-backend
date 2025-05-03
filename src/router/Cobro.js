const express = require('express');
const router = express.Router();
const Cobro = require('../services/Cobro');
const { default: axios } = require('axios');
const { sendFile, sendError } = require('../tools/Message');

const cobro = new Cobro();

router.get("/list", async (req, res) => await cobro.list(req, res));

router.post("/create", async (req, res) => await cobro.create(req, res));

router.get("/detail", async (req, res) => await cobro.detail(req, res));

router.delete("/cancel", async (req, res) => await cobro.cancel(req, res));

router.get("/documents/pdf/invoices/:idCobro/:size", async (req, res) => {
    try {
        const data = await cobro.documentsPdfInvoices(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/collection/pdf/invoices`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/reports", async (req, res) => await cobro.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await cobro.documentsPdfExcel(req, res));

module.exports = router;