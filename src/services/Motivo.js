const conec = require('../database/mysql-connection');
const { sendSuccess, sendError } = require('../tools/Message');

class Motivo {

    async listcombo(req, res) {
        try {
            let result = await conec.query(`SELECT idMotivo, nombre FROM motivo WHERE estado = 1`);
            return sendSuccess(res, result)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Motivo/listCombo", error);
        }
    }

}

module.exports = new Motivo();