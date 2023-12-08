const express = require('express');
const router = express.Router();
const Producto = require('../services/Producto');
const empresa = require('../services/Empresa');
const RepProducto = require('../report/RepProducto');
const { generateProductoDeuda } = require('../excel/FileProducto');
const { decrypt } = require('../tools/CryptoJS');
const { currentDate } = require('../tools/Tools');
const { sendError } = require('../tools/Message');

const producto = new Producto();

const repProducto = new RepProducto();

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

router.put('/establecer/preferido', async function (req, res) {
    const result = await producto.preferidoEstablecer(req)
    if (result === "update") {
        res.status(200).send("Se estableció como preferido el producto.")
    } else {
        res.status(500).send(result)
    }
})

router.get('/repproductodetalle', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idProducto = decryptedData.idProducto;
    req.query.idEmpresa = decryptedData.idEmpresa;

    const empresaInfo = await empresa.infoEmpresaReporte(req)

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo)
        return;
    }

    const detalle = await producto.detalle(req)

    if (typeof detalle === 'object') {

        let data = await repProducto.repDetalleProducto(empresaInfo, detalle)

        if (typeof data === 'string') {
            res.status(500).send(data)
        } else {
            res.setHeader('Content-disposition', 'inline; filename=Detalle del Producto.pdf');
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle)
    }
})

router.get('/reptipoProductos', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    // req.query.idProducto = decryptedData.idProducto;
    req.query.estadoProducto = decryptedData.estadoProducto;
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;

    const empresaInfo = await empresa.infoEmpresaReporte(req)

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo)
        return;
    }

    const detalle = await producto.listaEstadoProducto(req)

    if (typeof detalle === 'object') {

        let data = await repProducto.repTipoProducto(req, empresaInfo, detalle)

        if (typeof data === 'string') {
            res.status(500).send(data)
        } else {
            res.setHeader('Content-disposition', `inline; filename=DETALLE DE PRODUCTOS AL ${currentDate()}.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle);
    }
})

router.get('/replistardeudasProducto', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;
    req.query.nombreSucursal = decryptedData.nombreSucursal;
    req.query.porSucursal = decryptedData.porSucursal;

    const empresaInfo = await empresa.infoEmpresaReporte(req)

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo)
        return;
    }

    const detalle = await producto.listardeudasProducto(req)

    if (typeof detalle === 'object') {

        let data = await repProducto.repProductoDeuda(req, empresaInfo, detalle)

        if (typeof data === 'string') {
            res.status(500).send(data)
        } else {
            res.setHeader('Content-disposition', 'inline; filename=Lista de Productos con Deuda.pdf');
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle)
    }
})

router.get('/exacellistardeudasProducto', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;
    req.query.nombreSucursal = decryptedData.nombreSucursal;
    req.query.porSucursal = decryptedData.porSucursal;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        return sendError(res, empresaInfo);
    }

    const detalle = await producto.listardeudasProducto(req);

    if (Array.isArray(detalle)) {

        const data = await generateProductoDeuda(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            return sendError(res, data);
        } else {
            res.end(data);
        }
    } else {
        return sendError(res, detalle);
    }
})

module.exports = router;