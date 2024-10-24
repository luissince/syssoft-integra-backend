const express = require('express');
const router = express.Router();
const Persona = require('../services/Persona');

const persona = new Persona();

router.get('/list', async (req, res) => await persona.list(req, res));

router.get('/list/clientes', async (req, res) => await persona.listClientes(req, res));

router.get('/list/proveedores', async (req, res) => await persona.listProveedores(req, res));

router.get('/list/conductores', async (req, res) => await persona.listConductores(req, res));

router.post('/create', async (req, res) => await persona.create(req, res));

router.get('/id', async (req, res) => await persona.id(req, res));

router.post('/update', async (req, res) => await persona.update(req, res));

router.delete('/', async (req, res) => await persona.delete(req, res));

router.get('/combo', async (req, res) => await persona.combo(req, res));

router.get('/filtrar', async (req, res) => await persona.filtrar(req, res));

router.get('/predeterminado', async (req, res) => await persona.predeterminado(req, res));

router.get("/cliente/documents/pdf/reports", async (req, res) => await persona.clienteDocumentsPdfReports(req, res));

router.get("/cliente/documents/excel", async (req, res) => await persona.clienteDocumentsPdfExcel(req, res));

router.get("/proveedor/documents/pdf/reports", async (req, res) => await persona.proveedorDocumentsPdfReports(req, res));

router.get("/proveedor/documents/excel", async (req, res) => await persona.proveedorDocumentsPdfExcel(req, res));

module.exports = router;