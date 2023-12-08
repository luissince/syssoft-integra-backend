const express = require('express');
const router = express.Router();
const MotivoAjuste = require('../services/MotivoAjuste');

const motivoAjuste = new MotivoAjuste();

router.get('/combo', async function (req, res) {
    const result = await motivoAjuste.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;