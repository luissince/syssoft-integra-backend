const express = require('express');
const router = express.Router();
const tipoPedido = require('../controller/tipo-pedido.controller');

router.get('/combo', tipoPedido.combo);

module.exports = router;