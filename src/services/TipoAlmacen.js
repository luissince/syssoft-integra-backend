const conec = require('../database/mysql-connection');

class TipoAlmacen {
   
    async combo(req) {
        try {
            const lista = await conec.query(`
            SELECT 
                idTipoAlmacen, 
                nombre,
            FROM 
                tipoAlmacen`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = TipoAlmacen;