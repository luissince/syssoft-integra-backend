const express = require('express');
const router = express.Router();
const concepto = require('../services/Concepto');

router.get('/list', async (req, res) => await concepto.list(req, res))

router.post('/add', async (req, res) => await concepto.add(req, res))

router.get('/id', async (req, res) => await concepto.id(req, res))

router.post('/update', async (req, res) => await concepto.update(req, res))

router.delete('/', async (req, res) => await concepto.delete(req, res))

router.get('/listcombo', async (req, res) => await concepto.listcombo(req, res))

router.get('/listcombogasto', async (req, res) => await concepto.listcombogasto(req, res))

router.get('/filtrar/cobro', async (req, res) => await concepto.filtrarCobro(req, res))

router.get('/filtrar/gasto', async (req, res) => await concepto.filtrarGasto(req, res))

module.exports = router;
