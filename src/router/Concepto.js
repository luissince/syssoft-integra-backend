const express = require('express');
const router = express.Router();
const concepto = require('../services/Concepto');

router.get('/list', async function (req, res) {
    return await concepto.list(req, res);
});

router.post('/add', async function (req, res) {
    return await concepto.add(req, res);
});

router.get('/id', async function (req, res) {
    return await concepto.id(req, res);
});

router.post('/update', async function (req, res) {
    return await concepto.update(req, res);
});

router.delete('/', async function (req, res) {
    return await concepto.delete(req, res);
});

router.get('/listcombo', async function (req, res) {
    return await concepto.listcombo(req, res);
});

router.get('/listcombogasto', async function (req, res) {
    return await concepto.listcombogasto(req, res);
});

router.get('/filtrar/cobro', async function (req, res) {
    return await concepto.filtrarCobro(req, res);
});

router.get('/filtrar/gasto', async function (req, res) {
    return await concepto.filtrarGasto(req, res);
});

module.exports = router;
