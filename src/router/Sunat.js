const express = require('express');
const router = express.Router();
const Sunat = require('../services/Sunat');

const sunat = new Sunat();

router.get("/list/cpesunat", async (req, res) => await sunat.listCpeSunat(req, res));

router.get('/facturar/:idVenta', async (req, res) => await sunat.facturar(req, res));

router.get('/anular/boleta/:idVenta', async (req, res) => await sunat.anularBoleta(req, res));

router.get('/anular/factura/:idVenta', async (req, res) => await sunat.anularFactura(req, res));

router.get('/guia/remision/:idGuiaRemision', async (req, res) => await sunat.guiaRemision(req, res));

router.get('/consultar/:ruc/:usuario/:clave/:tipoComprobante/:serie/:numeracion', async (req, res) => await sunat.consultar(req, res));

router.get('/xml/:idComprobante', async (req, res) => await sunat.generarXmlSunat(req, res));

router.get('/dashboard', async (req, res) => await sunat.dashboard(req, res));

module.exports = router;