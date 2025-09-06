const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

class TipoPedido {
   
    async combo(req) {
        try {
            const lista = await conec.query(`
            SELECT 
                idTipoPedido, 
                nombre 
            FROM 
                tipoPedido`);        
            return lista;
        } catch (error) {        
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = TipoPedido;