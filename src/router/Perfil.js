const express = require('express');
const router = express.Router();
const perfil = require('../services/Perfil');

router.get('/list', async function (req, res) {
    return await perfil.list(req, res);
});

router.post('/add', async function (req, res) {
    return await perfil.add(req, res)
});

router.get('/id', async function (req, res) {
    return await perfil.id(req, res);
});

router.post('/update', async function (req, res) {
    return await perfil.update(req, res);
});

router.delete('/', async function (req, res) {
    return await perfil.delete(req, res)
});

router.get('/combo', async function (req, res) {
    return await perfil.combo(req, res)
});

module.exports = router;