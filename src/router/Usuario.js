const express = require('express');
const router = express.Router();
const usuario = require('../services/Usuario');

router.get('/list', async function (req, res) {
    return await usuario.list(req, res);
});

router.post('/', async function (req, res) {
   return await usuario.add(req, res);
});

router.put('/', async function (req, res) {
    return await usuario.update(req, res);
});

router.delete('/', async function (req, res) {
   return await usuario.delete(req, res);
});

router.post('/reset', async function (req, res) {
    return await usuario.reset(req, res);
});

router.get('/id', async function (req, res) {
   return await usuario.id(req, res);
});

router.get('/listcombo', async function (req, res) {
    return await usuario.listcombo(req, res);
})


module.exports = router;