const express = require('express');
const router = express.Router();
const usuario = require('../controller/usuario.controller');
const authenticate = require('../middlware/auth.middleware');

router.get('/list', usuario.list);

router.post('/', usuario.add);

router.put('/', usuario.update);

router.delete('/', usuario.remove);

router.post('/reset', usuario.reset);

router.get('/id', usuario.id);

router.get('/combo', usuario.combo);

router.get('/login', usuario.createSession);

router.get('/valid/token', authenticate, usuario.validToken);

module.exports = router;
