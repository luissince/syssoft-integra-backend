const express = require('express');
const router = express.Router();
const inventario = require('../controllers/inventario.controller');

router.get('/list', inventario.list);

router.get('/summary/:idAlmacen', inventario.summary);

router.put('/update/stock', inventario.updateStock);

router.get('/get/stock', inventario.getStock);

router.post('/dashboard', inventario.dashboard);

module.exports = router;