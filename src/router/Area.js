const express = require('express');
const router = express.Router();
const area = require('../services/Area');

router.get('/', async (req, res) => await area.list(req, res));

router.post('/', async (req, res) => await area.add(req, res));

router.put('/', async (req, res) => await area.update(req, res));

<<<<<<< HEAD
router.get('/combo', async (req, res) => await area.combo(req, res));

router.get('/:idArea/id', async (req, res) => await area.id(req, res));
=======
router.get('/:idArea', async (req, res) => await area.id(req, res));
>>>>>>> 480f14b (adding cargos, area)

router.delete('/:idArea', async (req, res) => await area.delete(req, res));

module.exports = router;