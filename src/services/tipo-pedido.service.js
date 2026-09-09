const conec = require('../database/mysql-connection');

class TipoPedido {

    async combo(req) {
        const list = await conec.query(`
        SELECT 
            idTipoPedido,
            nombre,
            descripcion,
            estado
        FROM 
            tipoPedido 
        WHERE 
            estado = 1`);

        return list;
    }

}

module.exports = new TipoPedido();