const conec = require('../database/mysql-connection');

class TipoEntrega {
   
    async combo(req) {
        try {
            const lista = await conec.query(`
            SELECT 
                idTipoEntrega, 
                nombre 
            FROM 
                tipoEntrega`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = TipoEntrega;