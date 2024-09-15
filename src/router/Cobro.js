const express = require('express');
const router = express.Router();
const cobro = require('../services/Cobro');

router.get("/list", async (req, res) => await cobro.list(req, res));

router.post("/create", async (req, res) => await cobro.create(req, res));

router.get("/detail", async (req, res) => await cobro.detail(req, res));

router.delete("/cancel", async (req, res) => await cobro.cancel(req, res));

module.exports = router;