const conec = require('../database/mysql-connection');

class MotivoTraslado {

    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idMotivoTraslado, 
            codigo, 
            nombre 
            FROM motivoTraslado`);
            return lista;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = MotivoTraslado;