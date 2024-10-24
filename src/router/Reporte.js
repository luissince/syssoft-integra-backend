const express = require('express');
const router = express.Router();
const Reporte = require('../services/Reporte');

const reporte = new Reporte();

// comprobante de ventas
router.post('/facturacion/venta/pre/pdf/a4', async (req, res) => await reporte.generarPreFacturacion(req, res, "a4"));
router.post('/facturacion/venta/pre/pdf/ticket', async (req, res) => await reporte.generarPreFacturacion(req, res, "ticket"));

// resportes
router.get('/venta/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reportePdfVenta(req, res));

router.get('/venta/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reporteExcelVenta(req, res));

router.get('/financiero/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal/:idUsuario', async (req, res) => await reporte.reportePdfFinanciero(req, res));

router.get('/financiero/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal/:idUsuario', async (req, res) => await reporte.reporteExcelFinanciero(req, res));


// CPE Sunat
router.get('/cpesunat/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal', async (req, res) => await reporte.reporteExcelCEPSunat(req, res));


module.exports = router;