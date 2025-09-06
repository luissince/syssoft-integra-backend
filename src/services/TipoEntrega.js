const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

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