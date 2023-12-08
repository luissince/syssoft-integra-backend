const Conexion = require('../database/Conexion');
const { sendSuccess, sendError } = require('../tools/Message');
const conec = new Conexion();

class Motivo {

    async listcombo(req, res) {
        try {
            let result = await conec.query(`SELECT idMotivo, nombre FROM motivo WHERE estado = 1`);
            return sendSuccess(res, result)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

}

module.exports = new Motivo();