const express = require('express');
const router = express.Router();
const ubicacionController = require('../controllers/ubicacion.controller');

// Rutas específicas primero
router.get('/list', ubicacionController.list);
router.get('/combo', ubicacionController.combo);

// Luego rutas dinámicas
router.get('/:idUbicacion', ubicacionController.id);

router.post('/', ubicacionController.add);
router.put('/', ubicacionController.edit);
router.delete('/:idUbicacion', ubicacionController.delete);

module.exports = router;
