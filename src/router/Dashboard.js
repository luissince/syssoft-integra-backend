const express = require('express');
const router = express.Router();
const dashboard = require('../services/Dashboard');

router.get('/init', async (req, res)=> await dashboard.init(req, res));

module.exports = router; 