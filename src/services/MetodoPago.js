const conec = require('../database/mysql-connection');

class MetodoPago {
   
    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idMetodoPago, 
            nombre, 
            predeterminado, 
            vuelto
            FROM metodoPago`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = MetodoPago;