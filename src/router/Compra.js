const express = require('express');
const router = express.Router();

const Compra = require('../services/Compra');

const compra = new Compra();

router.get('/list', async (req, res) => await compra.list(req, res));

router.get('/detail', async (req, res) => await compra.detail(req, res));

router.post('/create', async (req, res) => await compra.create(req, res));

router.delete('/cancel', async (req, res) => await compra.cancel(req, res));

router.get('/list/accounts/payable', async (req, res) => await compra.listAccountsPayable(req, res));

router.get("/detail/accounts/payable", async (req, res) => await compra.detailAccountsPayable(req, res));

router.post("/create/accounts/payable", async (req, res) => await compra.createAccountsPayable(req, res));

router.delete("/cancel/accounts/payable", async (req, res) => await compra.cancelAccountsPayable(req, res));

module.exports = router;