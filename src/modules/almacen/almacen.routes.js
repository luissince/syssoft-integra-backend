const express = require('express');
const router = express.Router();
const controller = require('./almacen.controller');

router.get('/list', controller.findAll);
router.post('/add', controller.create);
router.get('/id', controller.findById);
router.post('/update', controller.update);
router.delete('/delete', controller.deleteById);
router.get('/combo', controller.combo);
router.get('/:idSucursal/options', controller.options);

module.exports = router;
