const express = require('express');
const router = express.Router();
const ubigeo = require('../services/Ubigeo');

router.get('/', async function (req, res) {
    return await ubigeo.list(req, res);
});

module.exports = router;