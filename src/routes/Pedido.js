const express = require('express');
const router = express.Router();
const Pedido = require('../services/Pedido');

const pedido = new Pedido();

router.get('/list', async (req, res) => await pedido.list(req, res));

router.get('/:idPedido', async (req, res) => await pedido.id(req, res));

router.get('/detail/:idPedido', async (req, res) => await pedido.detail(req, res));

router.get('/for-sale', async (req, res) => await pedido.forSale(req, res));

router.post('/create', async (req, res) => await pedido.create(req, res));

router.put('/update', async (req, res) => await pedido.update(req, res));

router.delete('/cancel', async (req, res) => await pedido.cancel(req, res));

router.get("/pdf/:type/:idPedido/:size", async (req, res) => await pedido.pdfDocumentOrPreview(req, res));

router.get("/pdf/list", async (req, res) => await pedido.pdfList(req, res));

router.get("/excel", async (req, res) => await pedido.documentsPdfExcel(req, res));

module.exports = router;