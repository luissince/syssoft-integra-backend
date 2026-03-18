const express = require('express');
const router = express.Router();
const cargo = require('../services/Cargo');

router.get('/', async (req, res) => await cargo.list(req, res));

router.post('/', async (req, res) => await cargo.add(req, res));

router.put('/', async (req, res) => await cargo.update(req, res));

router.get('/:idCargo', async (req, res) => await cargo.id(req, res));

router.delete('/:idCargo', async (req, res) => await cargo.delete(req, res));

module.exports = router;