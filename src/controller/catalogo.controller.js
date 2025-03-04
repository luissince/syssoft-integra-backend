const catalogo = require('../services/catalogo.service');
const { sendSuccess, sendError, sendFile } = require('../tools/Message');

async function list(req, res) {
    try{
        const data = await catalogo.list(req.query);
        return sendSuccess(res, data);
    }catch(error){
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/list", error);    }
}

async function create(req, res) {
    try{
        const data = await catalogo.create(req.body);
        return sendSuccess(res, data);
    }catch(error){
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/create", error);
    }
}

async function id(req, res) {
    try{
        const data = await catalogo.id(req.params);
        return sendSuccess(res, data);
    }catch(error){
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/id", error);
    }
}

async function detail(req, res) {
    try{
        const data = await catalogo.detail(req.params);
        return sendSuccess(res, data);
    }catch(error){
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/detail", error);
    }
}

async function update(req, res) {
    try{
        const data = await catalogo.update(req.body);
        return sendSuccess(res, data);
    }catch(error){
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/update", error);
    }
}


async function documentsPdfCatalog(req, res) {
    try{
        const data = await catalogo.documentsPdfCatalog(req.params);
        return sendFile(res, data);
    }catch(error){
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfCatalog", error);
    }
}

module.exports = {
    list,
    create,
    id,
    detail,
    update,
    documentsPdfCatalog,
};