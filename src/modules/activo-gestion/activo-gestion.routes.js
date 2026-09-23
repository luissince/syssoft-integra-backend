const express = require('express');
const router = express.Router();
const activoGestionController = require('./activo-gestion.controller');

/**
 * =========================
 * GET
 * =========================
 */
router.get('/', activoGestionController.findAll);
router.get('/:idGestion/id', activoGestionController.findById);

/**
 * =========================
 * POST
 * =========================
 */
router.post('/', activoGestionController.create);
router.post('/devolver', activoGestionController.devolver);

/**
 * =========================
 * DELETE
 * =========================
 */
router.delete('/:id', activoGestionController.deleteById);

/**
 * =========================
 * PUT
 * =========================
 */
router.put('/', activoGestionController.update);

router.post('/reporte', activoGestionController.reportAsignacion);

router.post('/excel', activoGestionController.excelAsignacion);

module.exports = router;
