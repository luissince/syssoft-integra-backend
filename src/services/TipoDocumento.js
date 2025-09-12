const conec = require('../database/mysql-connection');
const { sendSuccess, sendError } = require('../tools/Message');

class TipoDocumento {

    async combo(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idTipoDocumento,
                nombre,
                longitud,
                obligado,
                tipoEntidad
            FROM 
                tipoDocumento 
            WHERE 
                estado = 1`);
            return sendSuccess(res, result)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","TipoDocumento/combo", error);
        }
    }

}

module.exports = new TipoDocumento();