const express = require('express');
const router = express.Router();
const Producto = require('../services/Producto');

const producto = new Producto();

router.get('/list', async function (req, res) {
    const result = await producto.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
})

router.post('/', async function (req, res) {
    const result = await producto.add(req)
    if (result === "insert") {
        res.status(200).send("Datos registrados correctamente.")
    } else {
        res.status(500).send(result)
    }
});

router.get('/id', async function (req, res) {
    const result = await producto.id(req)
    if (typeof result === "object") {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.put('/', async function (req, res) {
    const result = await producto.update(req)
    if (result === "update") {
        res.status(200).send("Los datos se actualizarón correctamente.");
    } else {
        res.status(500).send(result)
    }
});

router.delete('/', async function (req, res) {
    const result = await producto.delete(req);
    if (result === "delete") {
        res.status(200).send("Se eliminó correctamente el producto.");
    } else {
        res.status(500).send(result)
    }
});

router.get('/detalle', async function (req, res) {
    const result = await producto.detalle(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/combo', async function (req, res) {
    const result = await producto.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/filtrar/venta', async function (req, res) {
    const result = await producto.filtrarParaVenta(req)
    if (Array.isArray(result)) {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/filter', async function (req, res) {
    const result = await producto.filter(req)
    if (Array.isArray(result)) {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/filter/almacen', async function (req, res) {
    const result = await producto.filterAlmacen(req)
    if (Array.isArray(result)) {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/preferidos', async function (req, res) {
    const result = await producto.preferidos(req)
    if (Array.isArray(result)) {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/lista/precios', async function (req, res) {
    const result = await producto.obtenerListPrecio(req)
    if (Array.isArray(result)) {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});


router.put('/establecer/preferido', async function (req, res) {
    const result = await producto.preferidoEstablecer(req)
    if (result === "update") {
        res.status(200).send("Se estableció como preferido el producto.")
    } else {
        res.status(500).send(result)
    }
})



module.exports = router;