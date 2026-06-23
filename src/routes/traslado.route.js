const express = require('express');
const router = express.Router();

const traslado = require('../controller/traslado.controller');

router.get('/list', traslado.list);

router.get('/detail', traslado.detail);

router.post('/create', traslado.create);

router.delete('/cancel', traslado.cancel);

router.get('/pdf/:idTraslado/:size', traslado.pdf);

module.exports = router;