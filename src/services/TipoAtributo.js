const conec = require('../database/mysql-connection');

class TipoAtributo {

    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idTipoAtributo, 
            nombre 
            FROM tipoAtributo`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = TipoAtributo;