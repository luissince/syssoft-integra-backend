const express = require('express');
const router = express.Router();
const cargoController = require('./cargo.controller');

/**
 * =========================
 * GET
 * =========================
 */
router.get('/', cargoController.findAll);
router.get('/options', cargoController.options);
router.get('/:idCargo/id', cargoController.findById);

/**
 * =========================
 * POST
 * =========================
 */
router.post('/', cargoController.create);

/**
 * =========================
 * DELETE
 * =========================
 */
router.delete('/:id', cargoController.deleteById);

/**
 * =========================
 * PUT
 * =========================
 */
router.put('/', cargoController.update);

module.exports = router;
