const express = require('express');
const router = express.Router();
const venta = require('./venta.controller');

router.get('/list', venta.list);

router.get('/filter', venta.filter);

router.post('/create', venta.create);

router.delete('/cancel', venta.cancel);

router.get("/detail", venta.detail);

router.get("/details", venta.details);

router.get("/for-sale/:idVenta/:idAlmacen", venta.forSale);

router.get("/documents/pdf/invoices/:idVenta/:size/:outputType", venta.generatePdf);

module.exports = router;