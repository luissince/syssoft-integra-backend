const express = require('express');
const router = express.Router();
const Factura = require('../services/Factura');

const factura = new Factura();

router.get("/list/accounts/receivable", async (req, res) => await factura.listAccountsReceivable(req, res));

router.get("/detail/accounts/receivable", async (req, res) => await factura.detailAccountsReceivable(req, res));

router.post("/create/accounts/receivable", async (req, res) => await factura.createAccountsReceivable(req, res));

router.delete("/cancel/accounts/receivable", async (req, res) => await factura.cancelAccountsReceivable(req, res));

router.get("/dashboard", async (req, res) => await factura.dashboard(req, res));

router.get("/documents/pdf/account/receivable/:idCuota/:idVenta/:size", async (req, res) => await factura.documentsPdfAccountsReceivable(req, res));

router.get("/documents/pdf/reports", async (req, res) => await factura.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await factura.documentsPdfExcel(req, res));

module.exports = router;