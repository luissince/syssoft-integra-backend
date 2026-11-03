const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');
const { toNullString, toNullNumber } = require('../tools/Tools');

class Inventario {

    async list(req) {
        try {
            const {
                opcion,
                buscar,
                idAlmacen,
                estado,
                posicionPagina,
                filasPorPagina
            } = req.query;

            const result = await conec.procedureAll(`CALL Listar_Inventarios(?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(buscar),
                toNullString(idAlmacen),
                toNullNumber(estado),
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            // Genera lista con índice
            const resultLista = result[0].map((item, index) => {
                return {
                    ...item,
                    id: (index + 1) + parseInt(posicionPagina),
                    imagen: firebaseService.getUrl(item.imagen),
                };
            });

            const resumenRaw = result[2]?.[0] ?? {};

            const resumen = {
                totalInventarios: Number(resumenRaw.totalInventarios ?? 0),
                sinStock: Number(resumenRaw.sinStock ?? 0),
                stockBajo: Number(resumenRaw.stockBajo ?? 0),
                stockNormal: Number(resumenRaw.stockNormal ?? 0),
                stockAlto: Number(resumenRaw.stockAlto ?? 0)
            }

            return { "result": resultLista, "total": Number(result[1]?.[0]?.Total ?? 0), resumen };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async getStock(req) {
        try {
            const result = await conec.query(`
            SELECT 
                cantidadMaxima, 
                cantidadMinima 
            FROM 
                inventario 
            WHERE 
                idInventario = ?`, [
                req.query.idInventario
            ])

            return result[0]
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async updateStock(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                inventario 
            SET 
                cantidadMaxima = ?,
                cantidadMinima = ?
            WHERE 
                idInventario = ?`, [
                req.body.stockMaximo,
                req.body.stockMinimo,
                req.body.idInventario,
            ])

            await conec.commit(connection);
            return 'update';
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Inventario;