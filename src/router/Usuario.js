const express = require('express');
const { token, verify } = require('../tools/Jwt');
const router = express.Router();
const usuario = require('../services/Usuario');

router.get('/list', async (req, res) => await usuario.list(req, res));

router.post('/', async (req, res) => await usuario.add(req, res));

router.put('/', async (req, res) => await usuario.update(req, res));

router.delete('/', async (req, res) => await usuario.delete(req, res));

router.post('/reset', async (req, res) => await usuario.reset(req, res));

router.get('/id', async (req, res) => await usuario.id(req, res));

router.get('/combo', async (req, res) => await usuario.combo(req, res));

router.get('/login', async (req, res) => await usuario.createSession(req, res));

router.get('/valid/token', token, verify, async (req, res) => await usuario.validToken(req, res));

module.exports = router;