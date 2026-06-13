const express = require('express');
const router = express.Router();
const historial = require('./historial.controller');

router.get('/', historial.findAll);

module.exports = router;