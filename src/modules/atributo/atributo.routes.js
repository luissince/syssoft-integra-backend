const express = require('express');
const router = express.Router();
const atributoController = require('./atributo.controller');

/**
 * =========================
 * GET
 * =========================
 */
router.get('/', atributoController.findAll);
router.get('/:idAtributo/id', atributoController.findById);
router.get('/:idTipoAtributo/options', atributoController.options);

/**
 * =========================
 * POST
 * =========================
 */
router.post('/', atributoController.create);

/**
 * =========================
 * DELETE
 * =========================
 */
router.delete('/:idAtributo', atributoController.deleteById);

/**
 * =========================
 * PUT
 * =========================
 */
router.put('/', atributoController.update);

module.exports = router;
