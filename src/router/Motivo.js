const express = require('express');
const router = express.Router();
const motivo = require('../services/Motivo')

router.get('/listcombo', async function (req, res) {
    return await motivo.listcombo(req, res);
});

module.exports = router;