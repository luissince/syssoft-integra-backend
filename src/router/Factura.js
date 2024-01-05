const express = require('express');
const router = express.Router();
const factura = require('../services/Factura');
const empresa = require('../services/Empresa');
const RepCuota = require('../report/RepCuota');
const RepFactura = require('../report/RepFactura');
const { decrypt } = require('../tools/CryptoJS');
const { generateExcel } = require('../excel/FileVentas');
const { sendError } = require('../tools/Message');

const repCuota = new RepCuota();
const repFactura = new RepFactura();

router.get("/list", async function (req, res) {
    return await factura.list(req, res);
});

router.post("/create", async function (req, res) {
    return await factura.create(req, res);
});

router.delete("/cancel", async function (req, res) {
    return await factura.cancel(req, res);
});

router.get("/detail", async function (req, res) {
    return await factura.detail(req, res);
});

router.get("/accounts/receivable", async function (req, res) {
    return await factura.accountsReceivable(req, res);
});

module.exports = router;