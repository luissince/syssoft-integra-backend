const express = require('express');
const router = express.Router();
const dashboard = require('../controller/dashboard.controller');
const authenticate = require('../middlware/auth.middleware');
const validRoute = require('../middlware/valid-routes.middleware');
const { MENUS } = require('../config/constants');

router.get('/init', authenticate, validRoute(MENUS.DASHBOARD) ,dashboard.init);

module.exports = router; 
