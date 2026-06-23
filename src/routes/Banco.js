const express = require('express');
const router = express.Router();

const Banco = require('../services/Banco');

const banco = new Banco();

router.get('/list', async (req, res) => await banco.list(req, res));

router.post('/', async (req, res) => await banco.add(req, res));

router.get('/id', async (req, res) => await banco.id(req, res));

router.put('/', async (req, res) => await banco.update(req, res));

router.delete('/', async (req, res) => await banco.delete(req, res));

router.get('/combo/:idSucursal', async (req, res) => await banco.combo(req, res));

router.get('/detail', async (req, res) => await banco.detail(req, res));

router.get('/detail/list', async (req, res) => await banco.detailList(req, res));

module.exports = router;