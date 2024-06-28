const express = require('express');
const router = express.Router();
const sucursal = require('../services/Sucursal');

router.get('/list', async function (req, res) {
    return await sucursal.list(req, res);
});

router.post('/', async function (req, res) {
    return await sucursal.add(req, res);
});

router.put('/', async function (req, res) {
    return await sucursal.edit(req, res);
});

router.get('/id', async function (req, res) {
    return await sucursal.id(req, res);
});

router.delete('/', async function (req, res) {
    return await sucursal.delete(req, res);
});

router.get('/inicio', async function (req, res) {
    return await sucursal.inicio(req, res);
});

router.get('/id/inicio', async function (req, res) {
    return await sucursal.idInicio(req, res);
});

router.get('/combo',async function (req, res){
    return await sucursal.combo(req, res);
});

module.exports = router;