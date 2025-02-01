const express = require('express');
const router = express.Router();
const moneda = require('../services/Moneda');

router.get('/list', async (req, res) => await moneda.list(req, res));

router.post('/add', async (req, res) => await moneda.add(req, res));

router.post('/update', async (req, res) => await moneda.update(req, res));

router.get('/id', async (req, res) => await moneda.id(req, res));

router.delete('/', async (req, res) => await moneda.delete(req, res));

router.get('/combo', async (req, res) => await moneda.combo(req, res));

router.get('/nacional', async (req, res) => await moneda.nacional(req, res));

module.exports = router;
