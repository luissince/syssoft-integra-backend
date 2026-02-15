const express = require('express');
const router = express.Router();
const plazo = require('../controllers/plazo.controller');

router.get('/combo', plazo.combo);

module.exports = router;