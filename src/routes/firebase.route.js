const express = require('express');
const router = express.Router();

const firebase = require('../controller/firebase.controller');

router.get('/files', firebase.files);

module.exports = router;