const express = require('express');
const router = express.Router();
const { decrypt } = require('../tools/CryptoJS');
const { generateExcelCliente, generateExcelDeudas, generarSociosPorFecha } = require('../excel/FileClientes')
const empresa = require('../services/Empresa');
const Cliente = require('../services/Cliente');
const RepCliente = require('../report/RepCliente');

const cliente = new Cliente();
const repCliente = new RepCliente();
/**
 * Api usado en los modulos
 * [facturación: clientes]
 */
router.get('/list', async function (req, res) {
    const result = await cliente.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/listsocios', async function (req, res) {
    const result = await cliente.listsocios(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/add', async function (req, res) {
    const result = await cliente.add(req)
    if (result === 'insert') {
        res.status(201).send("Se registró correctamente el cliente.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await cliente.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/update', async function (req, res) {
    const result = await cliente.update(req)
    if (result === 'update') {
        res.status(201).send("Se actualizó correctamente el cliente.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {
    const result = await cliente.delete(req)
    if (result === 'delete') {
        res.status(201).send("Se eliminó correctamente el cliente.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/listcombo', async function (req, res) {
    const result = await cliente.listcombo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/filtrar', async function (req, res) {
    const result = await cliente.filtrar(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/predeterminado', async function (req, res) {
    const result = await cliente.predeterminado(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else if (result === "") {
        res.status(200).send("");
    } else {
        res.status(500).send(result);
    }
});
/**
 * Api usado en los modulos
 * [facturación: clientes/detalle]
 */
router.get('/listventasasociadas', async function (req, res) {
    const result = await cliente.listventasasociadas(req);
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/listcobrosasociados', async function (req, res) {
    const result = await cliente.listcobrosasociados(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/repcliente', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.fechaIni = decryptedData.fechaIni;
    req.query.fechaFin = decryptedData.fechaFin;
    req.query.idCliente = decryptedData.idCliente;
    req.query.cliente = decryptedData.cliente;

    const empresaInfo = await empresa.infoempresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const detalle = await cliente.listapagos(req)

    if (Array.isArray(detalle)) {
        let data = await repCliente.repGeneral(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=REPORTE DE APORTACIONES DE LOS CLIENTES.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle);
    }
});

router.get('/repclientehistorial', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idCliente = decryptedData.idCliente;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const detalle = await cliente.listventasasociadas(req)

    if (typeof detalle === 'object') {
        let data = await repCliente.repHistorial(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=HISTORIAL DEL CLIENTE.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle);
    }
});

router.get('/excelcliente', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.fechaIni = decryptedData.fechaIni;
    req.query.fechaFin = decryptedData.fechaFin;
    req.query.idCliente = decryptedData.idCliente;
    req.query.cliente = decryptedData.cliente;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const detalle = await cliente.listapagos(req)

    if (Array.isArray(detalle)) {

        if (req.query.idCliente == '') {
            const data = await generateExcelCliente(req, empresaInfo, detalle, 0);

            if (typeof data === 'string') {
                res.status(500).send(data);
            } else {
                res.end(data);
            }
        } else {
            const data = await generateExcelCliente(req, empresaInfo, detalle, 1);

            if (typeof data === 'string') {
                res.status(500).send(data);
            } else {
                res.end(data);
            }
        }
    } else {
        res.status(500).send(detalle);
    }
});

router.get('/repdeudas', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;
    req.query.nombreSucursal = decryptedData.nombreSucursal;
    req.query.seleccionado = decryptedData.seleccionado;
    req.query.frecuencia = decryptedData.frecuencia;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const detalle = await cliente.listadeudas(req)

    if (Array.isArray(detalle)) {
        let data = await repCliente.repDeudas(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=LISTA DE DEUDAS.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle);
    }
});

router.get('/exceldeudas', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;
    req.query.nombreSucursal = decryptedData.nombreSucursal;
    req.query.seleccionado = decryptedData.seleccionado;
    req.query.frecuencia = decryptedData.frecuencia;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const detalle = await cliente.listadeudas(req)

    if (Array.isArray(detalle)) {
        const data = await generateExcelDeudas(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.end(data);
        }
    } else {
        res.status(500).send(detalle);
    }
});

/**
 * 
 */
router.get("/updatealta", async function (req, res) {
    const result = await cliente.updatealta(req)
    if (result === "ok") {
        res.status(200).send("ok");
    } else {
        res.status(200).send(result);
    }
});

/**
 * 
 */
router.get("/replistarsociosporfecha", async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;
    req.query.nombreSucursal = decryptedData.nombreSucursal;
    req.query.yearPago = decryptedData.yearPago;
    req.query.porSucursal = decryptedData.porSucursal;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const clientes = await cliente.listarsociosporfecha(req);

    if (Array.isArray(clientes)) {
        const data = await repCliente.repListarSociosPorFecha(req, empresaInfo, clientes);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=REPORTE DE SOCIOS AGREGADOS POR FECHA.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(clientes);
    }
});

/**
 * 
 */
router.get("/exacellistarsociosporfecha", async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idSucursal = decryptedData.idSucursal;
    req.query.nombreSucursal = decryptedData.nombreSucursal;
    req.query.yearPago = decryptedData.yearPago;
    req.query.porSucursal = decryptedData.porSucursal;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo);
        return;
    }

    const clientes = await cliente.listarsociosporfecha(req);

    if (Array.isArray(clientes)) {
        const data = await generarSociosPorFecha(req, empresaInfo, clientes);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.end(data);
        }
    } else {
        res.status(500).send(clientes);
    }
});


module.exports = router;