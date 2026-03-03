const express = require('express');
const router = express.Router();
const venta = require('./venta.controller');

router.get('/', venta.findAll);

router.get('/filter-all', venta.filterAll);

router.post('/create', venta.create);

router.delete('/cancel', venta.cancel);

router.get("/:idVenta", venta.findById);

router.get("/:idVenta/details", venta.getDetailsById);

router.get("/for-sale/:idVenta/:idAlmacen", venta.forSale);

router.get("/documents/pdf/invoices/:idVenta/:size/:outputType", venta.generatePdf);

module.exports = router;