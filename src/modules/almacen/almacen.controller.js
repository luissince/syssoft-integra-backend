const { asyncHandler, makeController } = require("../../tools/AsyncHandler");

const AlmacenService = require('./almacen.service');
const almacenService = new AlmacenService();

const findAll = async (req, res) => {
    const result = await almacenService.findAll(req);
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
};

const create = async (req, res) => {
    const result = await almacenService.create(req);
    if (result === 'insert') {
        res.status(200).send("Se registró correctamente el almacén.");
    } else {
        res.status(400).send(result);
    }
};

const findById = async (req, res) => {
    const result = await almacenService.findById(req);
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
};

const update = async (req, res) => {
    const result = await almacenService.update(req);
    if (result === 'updated') {
        res.status(200).send("Se actualizó correctamente el almacén.");
    } else {
        res.status(400).send(result);
    }
};

const deleteById = async (req, res) => {
    const result = await almacenService.deleteById(req);
    if (result === 'deleted') {
        res.status(200).send("Se eliminó correctamente el almacén.");
    } else {
        res.status(400).send(result);
    }
};

const combo = async (req, res) => {
    const result = await almacenService.combo(req);
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
};

const options = async (req, res) => {
    const result = await almacenService.options(req.params.idSucursal);
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
};

module.exports = {
    findAll,
    create,
    findById,
    update,
    deleteById,
    combo,
    options
};
