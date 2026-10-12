const express = require('express');
const router = express.Router();
const Cotizacion = require('../services/Cotizacion');
const { sendFile, sendError } = require('../tools/Message');
const { default: axios } = require('axios');

const cotizacion = new Cotizacion();

router.get('/list', async (req, res) => await cotizacion.list(req, res));

router.get('/id', async (req, res) => await cotizacion.id(req, res));

router.get('/detail', async (req, res) => await cotizacion.detail(req, res));

router.get('/for-sale', async (req, res) => await cotizacion.forSale(req, res));

router.post('/create', async (req, res) => await cotizacion.create(req, res));

router.put('/update', async (req, res) => await cotizacion.update(req, res));

router.delete('/cancel', async (req, res) => await cotizacion.cancel(req, res));

router.get("/pdf/:type/:idCotizacion/:size", async (req, res) => cotizacion.pdfDocumentOrPreview(req, res));

router.get("/pdf/lists/", async (req, res) => cotizacion.pdfList(req, res));

router.get("/documents/pdf/reports", async (req, res) => await cotizacion.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await cotizacion.documentsPdfExcel(req, res));

module.exports = router;