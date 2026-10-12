const express = require('express');
const router = express.Router();
const catalogo = require('../controller/web.controller');

router.post('/', catalogo.create);

router.get('/', catalogo.id);

module.exports = router;