const express = require('express');
const router = express.Router();
const notaCredito = require('../services/NotaCredito');

/**
 * Api usado en los modulos
 * [facturación: nota de crédito]
 */
router.get('/list', async function (req, res) {
    return notaCredito.list(req, res);
});

router.get('/id', async function (req, res) {
    return notaCredito.id(req, res);
});

/**
 * Api usado en los modulos
 * [facturación: nota de crédito/preceso]
 */
router.post('/add', async function (req, res) {
    return notaCredito.add(req, res);
});

router.delete('/', async function (req, res) {
    return notaCredito.delete(req, res);
});

module.exports = router;