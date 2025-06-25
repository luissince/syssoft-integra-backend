const express = require('express');
const router = express.Router();

const Consulta = require('../services/Consulta');

const consulta = new Consulta();

router.get('/list', async (req, res) => await consulta.list(req, res));

router.post('/', async (req, res) => await consulta.add(req, res));

router.get('/:idConsulta', async (req, res) => await consulta.id(req, res));

router.put('/', async (req, res) => await consulta.update(req, res));

router.delete('/', async (req, res) => await consulta.delete(req, res));

router.get('/detail/:idConsulta', async (req, res) => await consulta.detail(req, res));


module.exports = router;