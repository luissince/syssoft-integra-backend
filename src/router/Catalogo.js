const express = require('express');
const router = express.Router();
const Catalogo = require('../services/Catalogo');

const catalogo = new Catalogo();

router.get('/list', async (req, res) => await catalogo.list(req, res));

router.post('/create', async (req, res) => await catalogo.create(req, res));

router.get('/id/:idCatalogo', async (req, res) => await catalogo.id(req, res));

router.get('/detail/:idCatalogo', async (req, res) => await catalogo.detail(req, res));

router.post('/update', async (req, res) => await catalogo.update(req, res));

router.get("/documents/pdf/:idCatalogo", async (req, res) => await catalogo.documentsPdfCatalog(req, res));

module.exports = router;