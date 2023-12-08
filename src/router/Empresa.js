const express = require('express');
const router = express.Router();
const empresa = require('../services/Empresa');
const { token, verify } = require('../tools/Jwt');

router.get('/load', async function (req, res) {
    return await empresa.load(req, res);
});

router.get('/id', async function (req, res) {
    return await empresa.id(req, res);
})

router.post('/update', async function (req, res) {
    return await empresa.update(req, res);
});

router.get('/config', async function (req, res) {
    return await empresa.config(req, res);
});

router.post('/save', async function (req, res) {
    return await empresa.save(req, res);
});

router.get('/combo', async function (req, res) {
    return await empresa.combo(req , res);
});

module.exports = router;