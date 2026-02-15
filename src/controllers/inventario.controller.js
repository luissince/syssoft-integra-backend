const inventarioService = require('../services/inventario.service');
const { sendError, sendSuccess, sendSave } = require('../tools/Message');

async function list(req, res) {
    try {
        const { opcion, buscar, idSucursal, idAlmacen, estado, posicionPagina, filasPorPagina } = req.query;

        const data = await inventarioService.list({
            opcion,
            buscar,
            idSucursal,
            idAlmacen,
            estado,
            posicionPagina,
            filasPorPagina
        });
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Error en listar el inventario.", "Inventario/list", error);
    }
}

async function summary(req, res) {
    try {
        const data = await inventarioService.summary({
            idAlmacen: req.params.idAlmacen
        });
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Error en obtener el resumen del inventario.", "Inventario/summary", error);
    }
}

async function getStock(req, res) {
    try {
        const data = await inventarioService.getStock({
            idInventario: req.query.idInventario
        });
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Error en obtener el inventario.", "Inventario/getStock", error);
    }
}

async function updateStock(req, res) {
    try {
        const data = await inventarioService.updateStock(req.body);
        return sendSave(res, data);
    } catch (error) {
        return sendError(res, "Error en actualizar el inventario.", "Inventario/updateStock", error);
    }
}

async function dashboard(req, res) {
    try {
        const data = await inventarioService.dashboard(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Error al obtener el dashboard.", "Inventario/dashboard", error);
    }
}

module.exports = {
    list,
    summary,
    getStock,
    updateStock,
    dashboard
};