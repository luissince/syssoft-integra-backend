const express = require('express');
const router = express.Router();
const catalogo = require('../controller/catalogo.controller');

router.get('/list', catalogo.list);

router.post('/create', catalogo.create);

router.get('/id/:idCatalogo', catalogo.id);

router.get('/detail/:idCatalogo', catalogo.detail);

router.post('/update', catalogo.update);

router.get("/documents/pdf/:idCatalogo", catalogo.documentsPdfCatalog);

module.exports = router;