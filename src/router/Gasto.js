const express = require('express');
const router = express.Router();
const gasto = require('../services/Gasto');

router.get("/list", async (req, res) => await gasto.list(req, res));

router.post("/create", async (req, res) => await gasto.create(req, res));

router.get("/detail", async (req, res) => await gasto.detail(req, res));

router.delete("/cancel", async (req, res) => await gasto.cancel(req, res));

module.exports = router;