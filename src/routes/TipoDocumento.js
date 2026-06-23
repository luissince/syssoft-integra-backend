const express = require('express');
const router = express.Router();
const tipoDocumento = require('../services/TipoDocumento')

router.get('/combo', async function (req, res) {
    return await tipoDocumento.combo(req, res);
});

module.exports = router;