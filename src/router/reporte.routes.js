const express = require('express');
const router = express.Router();
const reporte = require('../controllers/reporte.controller');

router.post('/main', reporte.main);

// // comprobante de ventas
// router.post('/facturacion/venta/pre/pdf/a4', async (req, res) => await reporte.generarPreFacturacion(req, res, "a4"));

// // resportes
// router.get('/venta/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reportePdfVenta(req, res));


module.exports = router;