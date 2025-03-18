const express = require('express');
const router = express.Router();
const empresa = require('../services/Empresa');

router.get('/load', async (req, res) => await empresa.load(req, res));

router.get('/id', async (req, res) => await empresa.id(req, res));

router.post('/update', async (req, res) => await empresa.update(req, res));

router.get('/config', async (req, res) => await empresa.config(req, res));

router.post('/save', async (req, res) => await empresa.save(req, res));

router.get('/combo', async (req, res) => await empresa.combo(req, res));

router.get('/web/info', async (req, res) => await empresa.getCompanyInfo(req, res));

router.get('/web/whatsapp', async (req, res) => await empresa.getCompanyWhatsApp(req, res));

module.exports = router;