const express = require('express');
const router = express.Router();
const dashboard = require('../controller/dashboard.controller');
const authenticate = require('../middlewares/auth.middleware');
const validRoute = require('../middlewares/valid-routes.middleware');
const { MENUS } = require('../common/constants/privileges.constants');

router.get('/init', authenticate, validRoute(MENUS.DASHBOARD) ,dashboard.init);

module.exports = router; 
