const express = require('express');
const router = express.Router();
const areaController = require('./area.controller');

/**
 * =========================
 * GET
 * =========================
 */
router.get('/', areaController.findAll);
router.get('/options', areaController.options);
router.get('/:idArea/id', areaController.findById);

/**
 * =========================
 * POST
 * =========================
 */
router.post('/', areaController.create);

/**
 * =========================
 * DELETE
 * =========================
 */
router.delete('/:idArea', areaController.deleteById);

/**
 * =========================
 * PUT
 * =========================
 */
router.put('/', areaController.update);

module.exports = router;
