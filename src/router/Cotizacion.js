const express = require('express');
const router = express.Router();
const Cotizacion = require('../services/Cotizacion');

const cotizacion = new Cotizacion();

router.get('/list', async (req, res) => await cotizacion.list(req, res));

router.get('/id', async (req, res) => await cotizacion.id(req, res));

router.get('/detail', async (req, res) => await cotizacion.detail(req, res));

router.post('/create', async (req, res) => await cotizacion.create(req, res));

router.delete('/cancel', async (req, res) => await cotizacion.cancel(req, res));

router.get('/create/report/a4/:idCotizacion', async (req, res) => await cotizacion.report(req, res));

router.get('/create/report/ticket/:idCotizacion', async (req, res) => await cotizacion.report(req, res));

module.exports = router;