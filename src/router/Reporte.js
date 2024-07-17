const express = require('express');
const router = express.Router();
const Reporte = require('../services/Reporte');

const reporte = new Reporte();

// comprobante de ventas
router.get('/facturacion/venta/pdf/a4/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "a4"));
router.get('/facturacion/venta/pdf/ticket/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "ticket"));

router.post('/facturacion/venta/pre/pdf/a4', async (req, res) => await reporte.generarPreFacturacion(req, res, "a4"));
router.post('/facturacion/venta/pre/pdf/ticket', async (req, res) => await reporte.generarPreFacturacion(req, res, "ticket"));

// comprobante de cobro
// router.get('/facturacion/cobro/pdf/a4/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "a4"));
// router.get('/facturacion/cobro/pdf/ticket/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "ticket"));

// router.post('/facturacion/cobro/pre/pdf/a4', async (req, res) => await reporte.generarPreFacturacion(req, res, "a4"));
// router.post('/facturacion/cobro/pre/pdf/ticket', async (req, res) => await reporte.generarPreFacturacion(req, res, "ticket"));

// comprobante de gasto
// router.get('/facturacion/gasto/pdf/a4/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "a4"));
// router.get('/facturacion/gasto/pdf/ticket/:idVenta', async (req, res) => await reporte.generarFacturacion(req, res, "ticket"));

// router.post('/facturacion/gasto/pre/pdf/a4', async (req, res) => await reporte.generarPreFacturacion(req, res, "a4"));
// router.post('/facturacion/gasto/pre/pdf/ticket', async (req, res) => await reporte.generarPreFacturacion(req, res, "ticket"));

// comprobante de cotización
router.get('/facturacion/cotizacion/pdf/a4/:idCotizacion', async (req, res) => await reporte.generarCotizacion(req, res, "a4"));
router.get('/facturacion/cotizacion/pdf/ticket/:idCotizacion', async (req, res) => await reporte.generarCotizacion(req, res, "ticket"));

router.post('/facturacion/cotizacion/pre/pdf/a4', async (req, res) => await reporte.generarPreCotizacion(req, res, "a4"));
router.post('/facturacion/cotizacion/pre/pdf/ticket', async (req, res) => await reporte.generarPreCotizacion(req, res, "ticket"));

router.get('/facturacion/cotizacion/pedido/pdf/a4/:idCotizacion', async (req, res) => await reporte.generarPedidoCotizacion(req, res));

// comprobante de guía de remisión
router.get('/facturacion/guiaremision/pdf/a4/:idGuiaRemision', async (req, res) => await reporte.generarGuiaRemision(req, res, "a4"));
router.get('/facturacion/guiaremision/pdf/ticket/:idGuiaRemision', async (req, res) => await reporte.generarGuiaRemision(req, res, "ticket"));

// comprobante de compra
router.get('/tesoreria/compra/pdf/a4/:idCompra', async (req, res) => await reporte.generarCompra(req, res));
router.get('/tesoreria/compra/pdf/ticket/:idCompra', async (req, res) => await reporte.generarCompra(req, res));


// resportes

router.get('/venta/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reportePdfVenta(req, res));

router.get('/venta/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idComprobante/:idSucursal/:idUsuario', async (req, res) => await reporte.reporteExcelVenta(req, res));

router.get('/financiero/pdf/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal/:idUsuario', async (req, res) => await reporte.reportePdfFinanciero(req, res));

router.get('/financiero/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal/:idUsuario', async (req, res) => await reporte.reporteExcelFinanciero(req, res));


// CPE Sunat
router.get('/cpesunat/excel/:idSucursalGenerado/:fechaInicio/:fechaFinal/:idSucursal', async (req, res) => await reporte.reporteExcelCEPSunat(req, res));

router.get('/cpesunat/xml/:idComprobante', async (req, res) => await reporte.generarXmlSunat(req, res))

module.exports = router;