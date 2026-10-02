const express = require('express');
const router = express.Router();
const Factura = require('../services/Factura');

const factura = new Factura();

router.get("/list", async (req, res) => await factura.list(req, res));

router.post("/create", async (req, res) => await factura.create(req, res));

router.delete("/cancel", async (req, res) => await factura.cancel(req, res));

router.get("/detail", async (req, res) => await factura.detail(req, res));

router.get("/for-sale", async (req, res) => await factura.forSale(req, res));

router.post("/create/accounts/receivable", async (req, res) => await factura.createAccountsReceivable(req, res));

router.delete("/cancel/accounts/receivable", async (req, res) => await factura.cancelAccountsReceivable(req, res));

router.get("/dashboard", async (req, res) => await factura.dashboard(req, res));

router.get("/filter/:filter/:idSucursal", async (req, res) => await factura.filter(req, res));

router.get("/shippingGuide/:idVenta", async (req, res) => await factura.shippingGuide(req, res));

router.get("/shippingGuide/:idVenta/details", async (req, res) => await factura.shippingGuideDetails(req, res));

router.get("/pdf/:type/:idVenta/:size/:outputType", async (req, res) => await factura.pdfDocumentOrPreview(req, res));

router.get("/pdf/account-receivable/:idVenta/:size", async (req, res) => await factura.documentsPdfAccountsReceivable(req, res));

router.get("/pdf/list", async (req, res) => await factura.documentsPdfReports(req, res));

router.get("/excel", async (req, res) => await factura.documentsPdfExcel(req, res));

module.exports = router;