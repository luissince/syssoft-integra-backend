const express = require('express');
const router = express.Router();
const Reporte = require('../services/Reporte');

const reporte = new Reporte();

// reporte de ventas
router.get('/facturacion/venta/pdf/a4/:idVenta', async (req, res) => await reporte.generarFacturacionVenta(req, res, "a4"));

router.get('/facturacion/venta/pdf/ticket/:idVenta', async (req, res) => await reporte.generarFacturacionVenta(req, res, "ticket"));

// reporte de cotización
router.get('/facturacion/cotizacion/pdf/a4/:idCotizacion', async (req, res) => await reporte.facturacionPdfA4Cotizacion(req, res));

router.get('/facturacion/cotizacion/pdf/ticket/:idCotizacion', async (req, res) => await reporte.facturacionPdfTicketCotizacion(req, res));

// reporte de guía de remisión
router.get('/facturacion/guiaremision/pdf/a4/:idCotizacion', async (req, res) => await reporte.facturacionPdfA4GuiRemision(req, res));

router.get('/facturacion/guiaremision/pdf/ticket/:idCotizacion', async (req, res) => await reporte.facturacionPdfTicketGuiaRemision(req, res));

// reporte de compra
router.get('/tesoreria/compra/pdf/a4/:idCompra', async (req, res) => await reporte.reportPdfFinanciero(req, res));

router.get('/tesoreria/compra/pdf/ticket/:idCompra', async (req, res) => await reporte.reportPdfFinanciero(req, res));


router.get('/venta/pdf', async (req, res) => await reporte.reportPdfFinanciero(req, res));

router.get('/venta/excel', async (req, res) => await reporte.reportExcelFinanciero(req, res));

router.get('/financiero/pdf/:fechaInicio/:fechaFinal', async (req, res) => await reporte.generarPdfFinanciero(req, res));

router.get('/financiero/excel/:fechaInicio/:fechaFinal', async (req, res) => await reporte.generarExcelFinanciero(req, res));

module.exports = router;