const express = require('express');
const router = express.Router();

const ycloud = require('../controller/ycloud.controller');

router.post('/text', ycloud.text);

router.post('/document', ycloud.document);

// Webhook de mensajes entrantes de YCloud
router.post("/webhook", ycloud.webhook);

module.exports = router;