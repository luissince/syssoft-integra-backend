const express = require('express');
const router = express.Router();

const guiaRemision = require('../controller/guia-remision.controller');

router.get('/list',  guiaRemision.list);

router.post('/create', guiaRemision.create);

router.get('/detail', guiaRemision.detail);

router.get('/id/:idGuiaRemision', guiaRemision.id);

router.put('/update', guiaRemision.update);

router.delete('/cancel', guiaRemision.cancel);

router.get('/pdf/:idGuiaRemision/:size', guiaRemision.pdf);

router.get("/documents/excel", guiaRemision.excel);

module.exports = router;