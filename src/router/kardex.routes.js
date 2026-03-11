const express = require('express');
const router = express.Router();
const kardex = require('../controllers/kardex.controller');

router.get('/list', kardex.list);

router.post('/depreciacion/lista', kardex.listarDepreciacion);

router.post('/depreciacion/detalle', kardex.detalleDepreciacion);

router.post('/depreciacion/create', kardex.createDepreciacion);

module.exports = router;