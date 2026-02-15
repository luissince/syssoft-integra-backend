const conec = require('../database/mysql-connection');

class KardexService {

    async list(data) {
        try {           
            const kardex = await conec.procedure(`CALL Listar_Kardex(?,?,?)`, [
                data.idAlmacen,
                data.idProducto,
                data.idSucursal,
            ]);


            const resultLista = kardex.map((item, index) => ({
                ...item,
                id: index + 1,
            }));

            return resultLista;
        } catch (error) {
            throw error;
        }
    }

}

module.exports = new KardexService();