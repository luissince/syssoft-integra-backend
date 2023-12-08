const express = require('express');
const router = express.Router();
const Kardex = require('../services/Kardex');

const kardex = new Kardex();

router.get('/list', async function (req, res) {
    const result = await kardex.list(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

module.exports = router;