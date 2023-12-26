const { sendSuccess, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Kardex {

    async list(req, res) {
        try {           
            const kardex = await conec.procedure(`CALL Listar_Kardex(?,?,?)`, [
                req.query.idAlmacen,
                req.query.idProducto,
                req.query.idSucursal,
            ]);
            return kardex;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Kardex;