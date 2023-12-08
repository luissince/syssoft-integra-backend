const express = require('express');
const router = express.Router();
const dashboard = require('../services/Dashboard');

router.get('/totales', async function (req, res) {
    return await dashboard.totales(req, res);
});

module.exports = router; 