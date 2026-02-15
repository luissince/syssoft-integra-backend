const express = require('express');
const router = express.Router();
const authenticate = require('../../middlware/auth.middleware');
const dashboard = require('./dashboard.controller');
const validRoute = require('../../middlware/valid-routes.middleware');
const { MENUS } = require('../../config/constants');

router.get('/init', authenticate, validRoute(MENUS.DASHBOARD), dashboard.init);

module.exports = router;