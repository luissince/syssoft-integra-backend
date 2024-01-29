const express = require('express');
const router = express.Router();
const { currentDate } = require('../tools/Tools');
const { decrypt } = require('../tools/CryptoJS');

const Banco = require('../services/Banco');
const empresa = require('../services/Empresa');
const RepFinanciero = require('../report/RepFinanciero');

const banco = new Banco();
const repFinanciero = new RepFinanciero();

router.get('/list', async function (req, res) {
    const result = await banco.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/', async function (req, res) {
    const result = await banco.add(req)
    if (result === 'insert') {
        res.status(201).send("Se registró correctamente el banco.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await banco.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.put('/', async function (req, res) {
    const result = await banco.update(req)
    if (result === 'update') {
        res.status(201).send("Se actualizó correctamente el banco.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {   
    const result = await banco.delete(req)
    if (result === 'delete') {
        res.status(201).send("Se eliminó correctamente el banco.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/combo', async function (req, res) {
    const result = await banco.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});


router.get('/detail', async function (req, res) {
    const result = await banco.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});


router.get('/iddetalle', async function (req, res) {
    const result = await banco.idDetalle(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/detalle', async function (req, res) {
    const result = await banco.detalleBanco(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/repdetallebanco', async function (req, res) {
    const decryptedData = decrypt(req.query.params, 'key-report-inmobiliaria');
    
    req.query.idBanco = decryptedData.idBanco;
    req.query.idEmpresa = decryptedData.idEmpresa;

    const empresaInfo = await empresa.infoEmpresaReporte(req)
    
    if (typeof empresaInfo !== 'object') {
        res.status(500).send(empresaInfo)
        return;
    }
    
    const detalle = await banco.detalleBancoReporte(req)
    if (typeof detalle === 'object') {

        let data = await repFinanciero.repDetalleBanco(empresaInfo, detalle);

        if (typeof data === 'string') {
            res.status(500).send(data);
        } else {
            res.setHeader('Content-disposition', `inline; filename=REPORTE DE CAJA BANCO AL ${currentDate()}.pdf`);
            res.contentType("application/pdf");
            res.send(data);
        }

    } else {
        res.status(500).send(detalle);
    }
});

module.exports = router;