const conec = require('../database/mysql-connection');

class TipoPeso {

    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idTipoPeso, 
            codigo, 
            nombre 
            FROM tipoPeso`);
            return lista;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = TipoPeso;