const express = require('express');
const router = express.Router();
const Atributo = require('../services/Atributo');

const atributo = new Atributo();

router.get('/list', async (req, res) => await atributo.list(req, res));

router.get('/id', async (req, res) => await atributo.id(req, res));

router.post('/', async (req, res) => await atributo.add(req, res));

router.put('/', async (req, res) => await atributo.edit(req, res));

router.delete('/', async (req, res) => await atributo.delete(req, res));

router.get('/combo', async (req, res) => await atributo.combo(req, res));

module.exports = router;