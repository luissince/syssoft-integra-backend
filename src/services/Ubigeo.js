const Conexion = require('../database/Conexion');
const { sendSuccess, sendError } = require('../tools/Message');
const conec = new Conexion();

class Ubigeo {

    async list(req, res) {
        try {
            let result = await conec.query(`SELECT idUbigeo ,ubigeo, departamento, provincia, distrito 
            FROM ubigeo
            WHERE 
            ubigeo LIKE CONCAT(?,'%')
            OR
            departamento LIKE CONCAT(?,'%')
            OR
            provincia LIKE CONCAT(?,'%')
            OR
            distrito LIKE CONCAT(?,'%')`, [
                req.query.filtrar,
                req.query.filtrar,
                req.query.filtrar,
                req.query.filtrar,
            ]);

            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }


}

module.exports = new Ubigeo();