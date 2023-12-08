const express = require('express');
const router = express.Router();
const { decrypt } = require('../tools/CryptoJS');
const empresa = require('../services/Empresa');
const Gasto = require('../services/Gasto');
const RepFactura = require('../report/RepFactura');

const gasto = new Gasto();
const repFactura = new RepFactura();

router.get('/list', async function (req, res) {
    const result = await gasto.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await gasto.create(req)
    if (result === 'create') {
        res.status(201).send("Se registró correctamente el gasto.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await gasto.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await gasto.cancel(req, res)
    if (result === 'cancel') {
        res.status(201).send("Se anualo correctamente el gasto.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/repcomprobante', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    req.query.idEmpresa = decryptedData.idEmpresa;
    req.query.idGasto = decryptedData.idGasto;

    const empresaInfo = await empresa.infoEmpresaReporte(req)

    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo)
        return;
    }

    const detalle = await gasto.id(req)

    if (typeof detalle === 'object') {

        let data = await repFactura.repGasto(req, empresaInfo, detalle);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=${detalle.cabecera.comprobante + " " + detalle.cabecera.serie + "-" + detalle.cabecera.numeracion}.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }
    } else {
        res.status(500).send(detalle);
    }
});

module.exports = router;