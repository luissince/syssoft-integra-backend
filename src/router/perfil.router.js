const express = require('express');
const router = express.Router();
const perfil = require('../controller/perfil.controller');
const authenticate = require('../middlware/auth.middleware');
const validRoute = require('../middlware/valid-routes.middleware');
const { MENUS, SUBMENUS, PRIVILEGIOS } = require('../tools/constants');

router.get('/list', authenticate, validRoute(MENUS.SEGURIDAD, SUBMENUS.PERFIL, PRIVILEGIOS.LISTAR_PERFIL), perfil.list);

router.post('/add', authenticate, validRoute(MENUS.SEGURIDAD, SUBMENUS.PERFIL, PRIVILEGIOS.CREAR_PERFIL), perfil.add)

router.get('/id', authenticate, validRoute(MENUS.SEGURIDAD, SUBMENUS.PERFIL, PRIVILEGIOS.EDITAR_PERFIL), perfil.id);

router.post('/update', authenticate, validRoute(MENUS.SEGURIDAD, SUBMENUS.PERFIL, PRIVILEGIOS.EDITAR_PERFIL), perfil.update);

router.delete('/', authenticate, validRoute(MENUS.SEGURIDAD, SUBMENUS.PERFIL, PRIVILEGIOS.ELIMINAR_PERFIL), perfil.remove);

router.get('/combo', authenticate, perfil.combo)

module.exports = router;
