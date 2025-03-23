const express = require('express');
const router = express.Router();
const acceso = require('../controller/acceso.controller');

router.get('/:idPerfil', acceso.accesos);

router.post('/', acceso.save);

router.patch('/', acceso.update);

module.exports = router;