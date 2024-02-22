const express = require('express');
const router = express.Router();
const factura = require('../services/Factura');

router.get("/list", async function (req, res) {
    return await factura.list(req, res);
});

router.get("/list/cpesunat", async function (req, res) {
    return await factura.listCpeSunat(req, res);
});

router.get("/filtrar", async function (req, res) {
    return await factura.filtrar(req, res);
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

router.get("/detail/only", async function (req, res) {
    return await factura.detailOnly(req, res);
});

router.get("/list/accounts/receivable", async function (req, res) {
    return await factura.listAccountsReceivable(req, res);
});

router.post("/collet/accounts/receivable", async function (req, res) {
    return await factura.colletAccountsReceivable(req, res);
});

router.get("/detail/accounts/receivable", async function (req, res) {
    return await factura.detailAccountsReceivable(req, res);
});

module.exports = router;