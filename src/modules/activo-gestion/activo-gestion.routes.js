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

module.exports = router;
