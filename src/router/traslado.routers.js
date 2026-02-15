const express = require('express');
const router = express.Router();
const traslado = require('../controllers/traslado.controller');

router.get('/list', traslado.list);

router.get('/detail', traslado.detail);

router.post('/create', traslado.create);

router.delete('/cancel', traslado.cancel);

module.exports = router;