const producto = require('../services/producto.service');
const { sendSuccess, sendError, sendClient, sendSave, sendFile } = require("../tools/Message");
const { ClientError } = require('../tools/Error');

async function list(req, res) {
    try {
        const data = await producto.list(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/list", error);
    }
}

async function create(req, res) {
    try {
        const data = await producto.create(req);
        return sendSave(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Producto/create", error);
        }
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/create", error);
    }
}

async function id(req, res) {
    try {
        const data = await producto.id(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/id", error);
    }
}

async function update(req, res) {
    try {
        const data = await producto.update(req);
        return sendSave(res, data);
    } catch (error) {
        if (error instanceof ClientError) {
            return sendClient(res, error.message, "Producto/update", error);
        }
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/update", error);
    }
}

async function remove(req, res) {
    try {
        const data = await producto.remove(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/delete", error);
    }
}

async function detalle(req, res) {
    try {
        const data = await producto.detalle(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/detalle", error);
    }
}

async function combo(req, res) {
    try {
        const data = await producto.combo(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/combo", error);
    }
}

async function filtrarParaVenta(req, res) {
    try {
        const data = await producto.filtrarParaVenta(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filtrarParaVenta", error);
    }
}

async function filter(req, res) {
    try {
        const data = await producto.filter(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filter", error);
    }
}

async function filterAlmacen(req, res) {
    try {
        const data = await producto.filterAlmacen(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterAlmacen", error);
    }
}

async function preferidoEstablecer(req, res) {
    try {
        const data = await producto.preferidoEstablecer(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/preferidoEstablecer", error);
    }
}

async function obtenerListPrecio(req, res) {
    try {
        const data = await producto.obtenerListPrecio(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/obtenerListPrecio", error);
    }
}

async function filterWebAll(req, res) {
    try {
        const data = await producto.filterWebAll(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebAll", error);
    }
}

async function filterWebId(req, res) {
    try {
        const data = await producto.filterWebId(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebId", error);
    }
}
    
async function filterWebRelatedId(req, res) {
    try {
        const data = await producto.filterWebRelatedId(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebRelatedId", error);
    }
}

async function documentsPdfReports(req, res) {
    try {
        const data = await producto.documentsPdfReports(req);
        return sendFile(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfReports", error);
    }
}

async function documentsPdfExcel(req, res) {
    try {
        const data = await producto.documentsPdfExcel(req);
        return sendFile(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfExcel", error);
    }
}

async function documentsPdfCodBar(req, res) {
    try {
        const data = await producto.documentsPdfCodBar(req);
        return sendFile(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfCodBar", error);
    }
}

async function dashboard(req, res) {
    try {
        const data = await producto.dashboard(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/dashboard", error);
    }
}

async function updateInventario(req, res) {
    try {
        const data = await producto.updateInventario(req);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/updateInventario", error);
    }
}

module.exports = {
    list,
    create,
    id,
    update,
    remove,
    detalle,
    combo,
    filtrarParaVenta,
    filter,
    filterAlmacen,
    preferidoEstablecer,
    obtenerListPrecio,
    filterWebAll,
    filterWebId,
    filterWebRelatedId,
    documentsPdfReports,
    documentsPdfExcel,
    documentsPdfCodBar,
    dashboard,
    updateInventario,
};