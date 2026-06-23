const express = require('express');
const router = express.Router();
const Marca = require('../services/Marca');

const marca = new Marca();

router.get('/list', async (req, res) => await marca.list(req, res));

router.get('/id', async (req, res) => await marca.id(req, res));

router.post('/', async (req, res) => await marca.add(req, res));

router.put('/', async (req, res) => await marca.edit(req, res));

router.delete('/', async (req, res) => await marca.delete(req, res));

router.get('/combo', async (req, res) => await marca.combo(req, res));

module.exports = router;