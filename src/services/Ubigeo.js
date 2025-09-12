const conec = require('../database/mysql-connection');
const { sendSuccess, sendError } = require('../tools/Message');

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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Ubigeo/list", error);
        }
    }


}

module.exports = new Ubigeo();