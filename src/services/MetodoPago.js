const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

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