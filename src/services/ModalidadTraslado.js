const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

class ModalidadTraslado {

    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idModalidadTraslado, 
            codigo, 
            nombre 
            FROM modalidadTraslado`);
            return lista;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = ModalidadTraslado;