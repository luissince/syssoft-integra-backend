const express = require('express');
const router = express.Router();
const controller = require('./tipoAlmacen.controller');

router.get('/combo', controller.combo);

module.exports = router;
