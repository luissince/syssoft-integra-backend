const express = require('express');
const router = express.Router();
const login = require('../services/Login');
const { token, verify } = require('../tools/Jwt');

/**
 * @swagger
 * components:
 *  schemas:
 *      User:
 *          type: object
 *          properties:
 *              usuario:
 *                  type: string
 *                  description: usuario para el inicio de sesión
 *              password:
 *                  type: string
 *                  description: contraseña para el inicio de sesión
 *          required:
 *              - usuario
 *              - password 
 *          example:
 *              usuario: admin
 *              password: admin
 */

/**
 * @swagger
 * components:
 *  securitySchemes:
 *      bearerAuth:
 *          type: http
 *          scheme: bearer
 *          bearerFormat: JWT
 * security:
 *  - bearerAuth: []
 */

/**
 * @swagger
 * /api/login/createsession:
 *  get:
 *      summary: retorna el token para el inicio de sesión
 *      tags: [Login]
 *      parameters:
 *          -   in: query
 *              name: usuario
 *              schema:
 *                  type: string
 *              required: true
 *              description: usuario para el inicio de sesión
 *          -   in: query
 *              name: password
 *              schema:
 *                  type: string
 *              required: true
 *              description: contraseña para el inicio de sesión
 * 
 *      responses:
 *          200:
 *              description: Creación del token
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *          400:
 *              description: Datos incorrectos
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: string
 *          500:
 *              description: Error del servidor
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: string
 */
router.get('/createsession', async function (req, res) {
    return await login.createsession(req, res);
});

/**
 * @swagger
 * /api/login/validtoken:
 *  get:
 *      summary: validar expiración del token
 *      tags: [Login]
 *      security:
 *          - bearerAuth: []
 *      responses:
 *          200:
 *              description: Token valido
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: string
 *          403:
 *              description: Token expirado
*              content:
 *                  application/json:
 *                      schema:
 *                          type: string
 *          500:
 *              description: Error del servidor
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: string
 */
router.get('/validtoken', token, verify,async function (req, res) {
    return await login.validtoken(req, res);
});

module.exports = router;