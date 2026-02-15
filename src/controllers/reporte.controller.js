const reporte = require('../services/reporte.service');
const { sendSuccess, sendError } = require('../tools/Message');

async function main(req, res) {
    try {
        const data = await reporte.main(req.body);
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Reporte/main", error);
    }
}

module.exports = {
    main
};