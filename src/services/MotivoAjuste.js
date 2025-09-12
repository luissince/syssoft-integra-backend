const conec = require('../database/mysql-connection');

class MotivoAjuste {

    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idMotivoAjuste, 
            codigo, 
            nombre 
            FROM motivoAjuste`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = MotivoAjuste;