const express = require('express');
const router = express.Router();
const Persona = require('../services/Persona');

const persona = new Persona();

/**
 * =========================
 * GET
 * =========================
 */
router.get('/list', async (req, res) => await persona.list(req, res));

router.get('/list/clientes', async (req, res) => await persona.listClientes(req, res));

router.get('/list/proveedores', async (req, res) => await persona.listProveedores(req, res));

router.get('/list/conductores', async (req, res) => await persona.listConductores(req, res));

router.get('/list/personales', async (req, res) => await persona.listPersonales(req, res));

router.get('/:idPersona/id', async (req, res) => await persona.id(req, res));

router.get('/preferred', async (req, res) => await persona.preferido(req, res));

router.get('/combo', async (req, res) => await persona.combo(req, res));

router.get('/filtrar', async (req, res) => await persona.filtrar(req, res));

router.get('/predeterminado', async (req, res) => await persona.predeterminado(req, res));

router.get("/cliente/documents/pdf/reports", async (req, res) => await persona.clienteDocumentsPdfReports(req, res));

router.get("/cliente/documents/excel", async (req, res) => await persona.clienteDocumentsPdfExcel(req, res));

router.get("/proveedor/documents/pdf/reports", async (req, res) => await persona.proveedorDocumentsPdfReports(req, res));

router.get("/proveedor/documents/excel", async (req, res) => await persona.proveedorDocumentsPdfExcel(req, res));


/**
 * =========================
 * POST
 * =========================
 */
router.post('/detail', async (req, res) => await persona.detail(req, res));

router.post('/create', async (req, res) => await persona.create(req, res));

router.post('/update', async (req, res) => await persona.update(req, res));

router.post('/login', async (req, res) => await persona.login(req, res));

/**
 * =========================
 * DELETE
 * =========================
 */
router.delete('/', async (req, res) => await persona.delete(req, res));

/**
 * =========================
 * PUT
 * =========================
 */

router.patch('/:idPersona', async (req, res) => await persona.updateWeb(req, res));

module.exports = router;