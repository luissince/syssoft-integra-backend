const express = require('express');
const router = express.Router();
const sucursal = require('../services/Sucursal');
const authenticate = require('../middlware/auth.middleware');

router.get('/list', async (req, res) => await sucursal.list(req, res));

router.post('/', async (req, res) => await sucursal.add(req, res));

router.put('/', async (req, res) => await sucursal.edit(req, res));

router.get('/id', async (req, res) => await sucursal.id(req, res));

router.delete('/', async (req, res) => await sucursal.delete(req, res));

router.get('/inicio', authenticate, async (req, res) => await sucursal.inicio(req, res));

router.get('/id/inicio', async (req, res) => await sucursal.idInicio(req, res));

router.get('/combo', async (req, res) => await sucursal.combo(req, res));

router.get('/list/web', async (req, res) => await sucursal.listForWeb(req, res));

module.exports = router;