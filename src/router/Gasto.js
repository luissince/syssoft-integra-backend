const express = require('express');
const router = express.Router();
const Gasto = require('../services/Gasto');
const { sendFile, sendError } = require('../tools/Message');
const { default: axios } = require('axios');

const gasto = new Gasto();

router.get("/list", async (req, res) => await gasto.list(req, res));

router.post("/create", async (req, res) => await gasto.create(req, res));

router.get("/detail", async (req, res) => await gasto.detail(req, res));

router.delete("/cancel", async (req, res) => await gasto.cancel(req, res));

router.get("/documents/pdf/invoices/:idGasto/:size", async (req, res) => {
    try {
        const data = await gasto.documentsPdfInvoices(req, res);

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/expense/pdf/invoices`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return sendFile(res, response);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/documentsPdfInvoices", error);
    }
});

router.get("/documents/pdf/reports", async (req, res) => await gasto.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await gasto.documentsPdfExcel(req, res));

module.exports = router;