const express = require('express');
const router = express.Router();
const factura = require('../services/Factura');
const empresa = require('../services/Empresa');
const RepCuota = require('../report/RepCuota');
const RepFactura = require('../report/RepFactura');
const { decrypt } = require('../tools/CryptoJS');
const { generateExcel } = require('../excel/FileVentas');
const { sendError } = require('../tools/Message');

const repCuota = new RepCuota();
const repFactura = new RepFactura();

/**
 * Api usado en los modulos
 * [facturación: ventas]
 */
router.get("/list", async function (req, res) {
    return await factura.list(req, res);
});

router.post("/create", async function (req, res) {
    return await factura.create(req, res);
});

router.delete("/cancel", async function (req, res) {
    return await factura.cancel(req, res);
});

/**
 * Api usado en los modulos
 * [facturación: ventas/detalle]
 */
router.get("/detail", async function (req, res) {
    return await factura.detail(req, res);
});

/**
 * Api usado en los modulos
 * [facturación: créditos]
 */
router.get("/credito", async function (req, res) {
    return await factura.credito(req, res);
});

/**
 * Api usado en los modulos
 * [facturación: créditos/proceso]
 */
router.get("/credito/detalle", async function (req, res) {
    return await factura.detalleCredito(req, res);
});

/**
 * Api usado en los modulos
 * [facturación: ventas/detalle]
 */
router.get("/venta/cobro", async function (req, res) {
    return await factura.ventaCobro(req, res);
});

router.get("/cpesunat", async function (req, res) {
    return await factura.cpesunat(req, res);
});

router.get('/repcomprobante', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idVenta = decryptedData.idVenta;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        return sendError(res, empresaInfo);
    }

    const detalle = await factura.idReport(req);

    if (typeof detalle === 'object') {

        let data = await repFactura.repComprobante(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            return sendError(res, data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=${detalle.cabecera.comprobante + " " + detalle.cabecera.serie + "-" + detalle.cabecera.numeracion}.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        return sendError(res, detalle);
    }
});

router.get("/repcreditoproducto", async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idVenta = decryptedData.idVenta;
    req.query.sucursal = decryptedData.sucursal;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        return sendError(res, empresaInfo);
    }

    const detalle = await factura.detalleCreditoReport(req);

    if (typeof detalle === 'object') {

        let data = await repCuota.repDetalleCuota(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            return sendError(res, data);
        } else {
            res.setHeader('Content-disposition', 'inline; filename=Cronograma de Pagos.pdf');
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        return sendError(res, detalle);
    }
});

router.get("/repgeneralventas", async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');

    req.query.idEmpresa = "EM0001";
    req.query.fechaIni = decryptedData.fechaIni;
    req.query.fechaFin = decryptedData.fechaFin;
    req.query.idComprobante = decryptedData.idComprobante;
    req.query.idCliente = decryptedData.idCliente;
    req.query.idUsuario = decryptedData.idUsuario;
    req.query.tipoVenta = decryptedData.tipoVenta;

    req.query.comprobante = decryptedData.comprobante;
    req.query.cliente = decryptedData.cliente;
    req.query.usuario = decryptedData.usuario;
    req.query.tipo = decryptedData.tipo;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        return sendError(res, empresaInfo);
    }

    const ventas = await factura.detalleVenta(req);

    if (Array.isArray(ventas)) {
        let data = await repFactura.repVentas(req, empresaInfo, ventas);

        if (typeof data === 'string') {
            return sendError(res, data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=REPORTE DE VENTAS.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        return sendError(res, ventas);
    }
});

router.get('/excelgeneralventas', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');

    req.query.idEmpresa = "EM0001";
    req.query.fechaIni = decryptedData.fechaIni;
    req.query.fechaFin = decryptedData.fechaFin;
    req.query.idComprobante = decryptedData.idComprobante;
    req.query.idCliente = decryptedData.idCliente;
    req.query.idUsuario = decryptedData.idUsuario;
    req.query.tipoVenta = decryptedData.tipoVenta;

    req.query.comprobante = decryptedData.comprobante;
    req.query.cliente = decryptedData.cliente;
    req.query.usuario = decryptedData.usuario;
    req.query.tipo = decryptedData.tipo;

    const empresaInfo = await empresa.infoEmpresaReporte(req);

    if (typeof empresaInfo !== 'object') {
        return sendError(res, empresaInfo);
    }

    const ventas = await factura.detalleVenta(req);

    if (Array.isArray(ventas)) {

        const data = await generateExcel(req, empresaInfo, ventas);

        if (typeof data === 'string') {
            return sendError(res, data);
        } else {
            res.end(data);
        }
    } else {
        return sendError(res, ventas);
    }
});

module.exports = router;