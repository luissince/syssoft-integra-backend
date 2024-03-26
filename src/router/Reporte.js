const express = require('express');
const router = express.Router();
const Reporte = require('../services/Reporte');

const reporte = new Reporte();

router.get('/financiero/pdf', async (req, res) => await reporte.reportPdfFinanciero(req, res));

router.get('/financiero/excel', async (req, res) => await reporte.reportExcelFinanciero(req, res));

module.exports = router;