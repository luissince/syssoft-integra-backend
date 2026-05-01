const express = require('express');
const router = express.Router();
const usuarioController = require('./usuario.controller');
const authenticate = require('../../middlware/auth.middleware');

/* ===============================
   CRUD USERS
================================ */

// GET /users
router.get("/", usuarioController.findAll);

// POST /users
router.post("/", usuarioController.create);

// GET /users/:id
router.get("/:idUsuario", usuarioController.findById);

// PUT /users/:id
router.put("/:idUsuario", usuarioController.update);

// DELETE /users/:id
router.delete("/:idUsuario", usuarioController.deleteById);

/* ===============================
   EXTRA DATA (Dropdowns, etc)
================================ */

// GET /users/select-options
router.get("/select/options", usuarioController.getSelectOptions);


/* ===============================
   AUTH ACTIONS (Better separated)
================================ */

// POST /users/reset-password
router.post("/authenticate", usuarioController.authenticate);

router.post("/refresh-token", usuarioController.refreshToken);

router.post("/reset-password", usuarioController.resetPassword);

module.exports = router;
