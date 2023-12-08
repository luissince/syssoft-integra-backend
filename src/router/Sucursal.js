const express = require('express');
const router = express.Router();
const sucursal = require('../services/Sucursal');

/**
 * endpoint
 * [/api/sucursal/*]
 */

router.get('/list', async function (req, res) {
    return await sucursal.list(req, res);
});


/**
 * @swagger
 * /api/sucursal/:
 *  post:
 *      summary: Registrar un nuevo sucursal
 *      tags: [Sucursal]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          nombre:
 *                              type: string
 *                          
 *      responses:
 *          201:
 *              description: Sucursal creado
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
router.post('/', async function (req, res) {
    return await sucursal.add(req, res);
});

router.put('/', async function (req, res) {
    return await sucursal.edit(req, res);
});

router.get('/id', async function (req, res) {
    return await sucursal.id(req, res);
});

router.delete('/', async function (req, res) {
    return await sucursal.delete(req, res);
});

router.get('/inicio', async function (req, res) {
    return await sucursal.inicio(req, res);
});

router.get('/combo',async function (req, res){
    return await sucursal.combo(req, res);
});

module.exports = router;