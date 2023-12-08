const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

class TipoAjuste {
   
    async combo(req) {
        try {
            const lista = await conec.query(`SELECT 
            idTipoAjuste, 
            nombre 
            FROM tipoAjuste`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = TipoAjuste;