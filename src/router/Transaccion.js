const express = require('express');
const router = express.Router();
const Transaccion = require('../services/Transaccion');

const transaccion = new Transaccion();

router.get('/dashboard', async (req, res) => await transaccion.dashboard(req, res));

module.exports = router;