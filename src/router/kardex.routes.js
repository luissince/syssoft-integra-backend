const express = require('express');
const router = express.Router();
const kardex = require('../controllers/kardex.controller');

router.get('/list', kardex.list);

module.exports = router;