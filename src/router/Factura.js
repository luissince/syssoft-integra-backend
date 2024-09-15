const express = require('express');
const router = express.Router();
const factura = require('../services/Factura');

router.get("/list", async (req, res) => await factura.list(req, res));

router.get("/list/cpesunat", async (req, res) => await factura.listCpeSunat(req, res));

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

module.exports = router;