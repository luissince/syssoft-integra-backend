const express = require('express');
const router = express.Router();
const acceso = require('../services/Acceso');

router.get('/accesos', async function (req, res) {
    return await acceso.accesos(req, res);
});

router.post('/save', async function (req, res) {
    return await acceso.save(req, res);
});

router.post('/updatedata', async function (req, res) {
    return await acceso.updatedata(req,res);
});

module.exports = router;