const express = require('express');
const router = express.Router();

const ycloud = require('../controller/ycloud.controller');

router.post('/text', ycloud.text);

router.post('/document', ycloud.document);

module.exports = router;