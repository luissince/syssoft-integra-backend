const express = require('express');
const router = express.Router();
const plazo = require('../controller/plazo.controller');

router.get('/combo', plazo.combo);

module.exports = router;