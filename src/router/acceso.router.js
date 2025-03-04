const express = require('express');
const router = express.Router();
const acceso = require('../controller/acceso.controller');

router.get('/accesos', acceso.accesos);

router.post('/save', acceso.save);

router.post('/update', acceso.update);

module.exports = router;