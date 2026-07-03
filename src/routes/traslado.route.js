const express = require('express');
const router = express.Router();

const traslado = require('../controller/traslado.controller');

router.get('/list', traslado.list);

router.get('/detail', traslado.detail);

router.post('/create', traslado.create);

router.delete('/cancel', traslado.cancel);

router.get('/pdf/:idTraslado/:size', traslado.pdf);

router.get('/shipping-guide/:idTraslado', traslado.shippingGuide);

router.get('/shipping-guide/:idTraslado/details', traslado.shippingGuideDetails);

module.exports = router;