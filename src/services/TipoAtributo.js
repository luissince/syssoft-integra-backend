const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

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