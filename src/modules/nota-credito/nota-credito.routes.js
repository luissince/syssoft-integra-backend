const express = require('express');
const router = express.Router();
const notaCredito = require('./nota-credito.controller');

/**
 * =========================
 * GET
 * =========================
 */
router.get('/', notaCredito.findAll);
router.get('/:idNotaCredito', notaCredito.findById);
router.get('/:idNotaCredito/detail', notaCredito.detail);
router.get("/:idNotaCredito/submit", notaCredito.submit);
router.get("/:idNotaCredito/pdf/:size/:outputType", notaCredito.pdf);
router.get("/:idNotaCredito/xml", notaCredito.xml);
router.get("/:idNotaCredito/send-email", notaCredito.sendEmail);
router.get("/:idNotaCredito/send-whatsapp", notaCredito.sendWhatsapp);

/**
 * =========================
 * POST
 * =========================
 */
router.post('/', notaCredito.create);

/**
 * =========================
 * DELETE
 * =========================
 */
router.delete('/:idNotaCredito', notaCredito.deleteById);

/**
 * =========================
 * PUT
 * ========================= 
 */

module.exports = router;