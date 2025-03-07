const express = require('express');
const router = express.Router();
const Transaccion = require('../services/Transaccion');

const transaccion = new Transaccion();

router.get('/list', async (req, res) => await transaccion.list(req, res));

router.get('/dashboard', async (req, res) => await transaccion.dashboard(req, res));

router.get("/documents/pdf/reports", async (req, res) => await transaccion.documentsPdfReports(req, res));

module.exports = router;