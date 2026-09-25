const express = require('express');
const router = express.Router();

const dniruc = require('../controller/dniruc.controller');

router.get('/dni/:documento', dniruc.dni);

router.get('/ruc/:documento', dniruc.ruc);

module.exports = router;