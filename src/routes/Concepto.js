const express = require('express');
const router = express.Router();
const concepto = require('../services/Concepto');

router.get('/list', async (req, res) => await concepto.list(req, res))

router.post('/add', async (req, res) => await concepto.add(req, res))

router.get('/id', async (req, res) => await concepto.id(req, res))

router.post('/update', async (req, res) => await concepto.update(req, res))

router.delete('/', async (req, res) => await concepto.delete(req, res))

router.get('/filtrar', async (req, res) => await concepto.filtrarConcepto(req, res))

module.exports = router;
