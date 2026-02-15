const express = require('express');
const router = express.Router();
const notaCredito = require('./nota-credito.controller');

router.get('/', notaCredito.findAll);

router.post('/', notaCredito.create);

router.get('/:id', notaCredito.findById);

router.delete('/:id', notaCredito.deleteById);

router.get('/:id/detail', notaCredito.detail);

router.get("/:id/submit", notaCredito.submit);

router.get("/:id/pdf", notaCredito.pdf);

router.get("/:id/xml", notaCredito.xml);

router.get("/:id/send-email", notaCredito.sendEmail);

router.get("/:id/send-whatsapp", notaCredito.sendWhatsapp);

module.exports = router;