const express = require('express');
const router = express.Router();
const tipoDocumento = require('../services/TipoDocumento')

router.get('/listcombo', async function (req, res) {
    return await tipoDocumento.listcombo(req, res);
});

module.exports = router;