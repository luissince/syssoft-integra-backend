const express = require('express');
const router = express.Router();
const agencia = require('../controller/agencia.controller');

router.get('/combo', agencia.combo);

module.exports = router;