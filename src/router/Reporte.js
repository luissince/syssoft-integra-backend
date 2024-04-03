const express = require('express');
const router = express.Router();
const Reporte = require('../services/Reporte');

const reporte = new Reporte();

// comprobante de ventas
router.get('/facturacion/venta/pdf/a4/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "a4"));

router.get('/facturacion/venta/pdf/ticket/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "ticket"));

// comprobante de cotización
router.get('/facturacion/cotizacion/pdf/a4/:idCotizacion', async (req, res) => await reporte.generarCotizacion(req, res));

router.get('/facturacion/cotizacion/pdf/ticket/:idCotizacion', async (req, res) => await reporte.generarCotizacion(req, res));

// comprobante de guía de remisión
router.get('/facturacion/guiaremision/pdf/a4/:idCotizacion', async (req, res) => await reporte.generarGuiaRemision(req, res));

router.get('/facturacion/guiaremision/pdf/ticket/:idCotizacion', async (req, res) => await reporte.generarGuiaRemision(req, res));

// comprobante de compra
router.get('/tesoreria/compra/pdf/a4/:idCompra', async (req, res) => await reporte.generarCompra(req, res));

router.get('/tesoreria/compra/pdf/ticket/:idCompra', async (req, res) => await reporte.generarCompra(req, res));


// resportes

router.get('/venta/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reportPdfVenta(req, res));

router.get('/venta/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reportExcelVenta(req, res));

router.get('/financiero/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal/:idUsuario', async (req, res) => await reporte.reportePdfFinanciero(req, res));

router.get('/financiero/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal/:idUsuario', async (req, res) => await reporte.reporteExcelFinanciero(req, res));

module.exports = router;