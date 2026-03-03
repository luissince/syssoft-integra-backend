const express = require('express');
const router = express.Router();
const motivo = require('./motivo.controller');

router.get('/options', motivo.options);

module.exports = router;