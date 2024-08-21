const express = require('express');
const router = express.Router();
const acceso = require('../services/Acceso');

router.get('/accesos', async (req, res) => await acceso.accesos(req, res));

router.post('/save', async (req, res) => await acceso.save(req, res));

router.post('/update', async (req, res) => await acceso.update(req, res));

module.exports = router;