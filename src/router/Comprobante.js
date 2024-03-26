const express = require('express');
const router = express.Router();
const comprobante = require('../services/Comprobante');

router.get('/list', async (req, res) => await comprobante.list(req, res));

router.post('/add', async (req, res) => await comprobante.add(req, res));

router.get('/id', async (req, res) => await comprobante.id(req, res));

router.post('/edit', async (req, res) => await comprobante.edit(req, res));

router.delete('/', async (req, res) => await comprobante.delete(req, res));

router.get('/combo', async (req, res) => await comprobante.combo(req, res));

module.exports = router;