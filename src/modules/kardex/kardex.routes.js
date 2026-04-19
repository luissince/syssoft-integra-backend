const express = require('express');
const router = express.Router();
const kardexController = require('./kardex.controller');

router.get('/', kardexController.findAll);

router.get('/depreciacion/metrics', kardexController.metricsDepreciations);

router.get('/asset/list', kardexController.findAllAsset);

router.post('/depreciacion/list', kardexController.findAllDepreciations);

router.post('/depreciacion/detalle', kardexController.detailDepreciations);

router.post('/depreciacion/create', kardexController.createDepreciations);

router.post('/depreciacion/devolver', kardexController.findAllDepreciationsToReturn);

module.exports = router;
