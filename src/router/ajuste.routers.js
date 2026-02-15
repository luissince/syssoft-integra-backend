const express = require('express');
const router = express.Router();
const ajuste = require('../controllers/ajuste.controller');

router.get('/list', ajuste.list);

router.get('/detail', ajuste.detail);

router.post('/create', ajuste.create);

router.delete('/cancel', ajuste.cancel);

module.exports = router;