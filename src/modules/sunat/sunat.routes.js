const express = require('express');
const router = express.Router();
const sunat = require('./sunat.controller');

/**
 * =========================
 * LISTAR
 * =========================
 */

router.get("/", sunat.findAll);

/**
 * =========================
 * FACTURA O BOLETA
 * =========================
 */

// Enviar boleta o factura
router.get('/facturar/:idVenta', sunat.submitInvoice);

// Anular boleta
router.get('/resumen-diario/:idVenta', sunat.voidReceipt);

// Anular factura
router.get('/comunicacion-de-baja/:idVenta', sunat.voidInvoice);


/**
 * =========================
 * NOTAS DE CRÉDITO
 * =========================
 */

// Enviar nota de crédito
router.get('/nota-credito/:idNotaCredito', sunat.submitCreditNote);

// Anular tipo boleta 
router.get('/nota-credito/resumen-diario/:idNotaCredito', sunat.voidReceiptCreditNote);

// Anular tipo factura
router.get('/nota-credito/comunicacion-de-baja/:idNotaCredito', sunat.voidInvoiceCreditNote);

/**
 * =========================
 * GUÍAS DE REMISIÓN
 * =========================
 */

// Enviar remision
router.get('/guia-remision/:idGuiaRemision', sunat.submitDispatchAdvance);

/**
 * =========================
 * CONSULTAS
 * =========================
 */

// Consultar estado de comprobante
router.get('/consultar/:ruc/:usuario/:clave/:tipoComprobante/:serie/:numeracion', sunat.getStatus);

// Consultar CDR
router.get('/cdr/:ruc/:usuario/:clave/:tipoComprobante/:serie/:numeracion', sunat.getCdr);

// Enviar email
router.get('/email/:idComprobante/:tipo', sunat.sendEmail);

// Obtener XML
router.get('/xml/:idComprobante', sunat.getXml);

/**
 * =========================
 * DASHBOARD
 * =========================
 */

// Dashboard
router.get('/dashboard', sunat.dashboard);

module.exports = router;