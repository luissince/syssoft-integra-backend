const express = require('express');
const router = express.Router();
const Almacen = require('../services/Almacen');

const almacen = new Almacen();

router.get('/list', async function (req, res) {
    const result = await almacen.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/add', async function (req, res) {
    const result = await almacen.add(req)
    if (result === 'insert') {
        res.status(200).send("Se registró correctamente el almacén.");
    } else {
        res.status(400).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await almacen.id(req)  
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/update', async function (req, res) {
    const result = await almacen.update(req)
    if (result === 'updated') {
        res.status(200).send("Se actualizó correctamente el almacén.");
    } else {
        res.status(400).send(result);
    }
});

router.delete('/delete', async function (req, res) {
    const result = await almacen.delete(req)
    if (result === 'deleted') {
        res.status(200).send("Se eliminó correctamente el almacén.");
    } else {
        res.status(400).send(result);
    }
});

router.get('/combo', async function (req, res) {
    const result = await almacen.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;