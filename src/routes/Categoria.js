const express = require('express');
const router = express.Router();
const Categoria = require('../services/Categoria');

const categoria = new Categoria();

router.get('/list', async (req, res) => await categoria.list(req, res));

router.get('/id', async (req, res) => await categoria.id(req, res));

router.post('/', async (req, res) => await categoria.add(req, res));

router.put('/', async (req, res) => await categoria.edit(req, res));

router.delete('/', async (req, res) => await categoria.delete(req, res));

router.get('/combo', async (req, res) => await categoria.combo(req, res));

module.exports = router;