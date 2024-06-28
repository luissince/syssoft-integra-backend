const { currentDate, currentTime } = require('../tools/Tools');
const { sendSuccess, sendError, sendClient } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Concepto {

    async list(req, res) {
        try {
            let lista = await conec.query(`SELECT 
                idConcepto,
                nombre,
                tipo,
                sistema,
                DATE_FORMAT(fecha,'%d/%m/%Y') as fecha,
                hora 
                FROM concepto
                WHERE 
                ? = 0
                OR
                ? = 1 and nombre like concat(?,'%')
                LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            let resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            let total = await conec.query(`SELECT COUNT(*) AS Total FROM concepto
                WHERE 
                ? = 0
                OR
                ? = 1 and nombre like concat(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar
            ]);


            return sendSuccess(res, { "result": resultLista, "total": total[0].Total })
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let result = await conec.execute(connection, 'SELECT idConcepto FROM concepto');
            let idConcepto = "";
            if (result.length != 0) {

                let quitarValor = result.map(function (item) {
                    return parseInt(item.idConcepto.replace("CP", ''));
                });

                let valorActual = Math.max(...quitarValor);
                let incremental = valorActual + 1;
                let codigoGenerado = "";
                if (incremental <= 9) {
                    codigoGenerado = 'CP000' + incremental;
                } else if (incremental >= 10 && incremental <= 99) {
                    codigoGenerado = 'CP00' + incremental;
                } else if (incremental >= 100 && incremental <= 999) {
                    codigoGenerado = 'CP0' + incremental;
                } else {
                    codigoGenerado = 'CP' + incremental;
                }

                idConcepto = codigoGenerado;
            } else {
                idConcepto = "CP0001";
            }

            await conec.execute(connection, `INSERT INTO concepto(
                idConcepto, 
                nombre, 
                tipo,
                codigo,
                sistema,
                fecha, 
                hora,
                fupdate,
                hupdate,
                idUsuario) 
                VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                idConcepto,
                req.body.nombre,
                req.body.tipo,
                req.body.codigo,
                0,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario
            ])

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente el concepto.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/add", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query('SELECT * FROM concepto WHERE idConcepto  = ?', [
                req.query.idConcepto
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, 'Datos no encontados.');
            }
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `UPDATE concepto SET 
            nombre=?, 
            tipo=?,
            codigo=?,
            fupdate=?,
            hupdate=?,
            idUsuario=?
            WHERE idConcepto=?`, [
                req.body.nombre,
                req.body.tipo,
                req.body.codigo,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idConcepto,
            ])

            await conec.commit(connection)
            return sendSuccess(res, 'Se actualizó correctamente el concepto.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/update", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const sistem = await conec.execute(connection, `SELECT * FROM cobroDetalle WHERE idConcepto = ? AND sistema = 1`, [
                req.query.idConcepto
            ]);

            if(sistem.length > 0){
                await conec.rollback(connection);
                return sendClient(res, 'El concepto es del propio sistema, puede ser eliminado.');
            }

            const cobroDetalle = await conec.execute(connection, `SELECT * FROM cobroDetalle WHERE idConcepto = ?`, [
                req.query.idConcepto
            ]);

            if (cobroDetalle.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el concepto ya que esta ligada a un detalle de cobro.');
            }

            const gastoDetalle = await conec.execute(connection, `SELECT * FROM gastoDetalle WHERE idConcepto = ?`, [
                req.query.idConcepto
            ]);

            if (gastoDetalle.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el concepto ya que esta ligada a un detalle de gasto.');
            }

            const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idConcepto = ?`, [
                req.query.idConcepto
            ]);

            if (producto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el concepto ya que esta ligada a un producto.');
            }

            await conec.execute(connection, `DELETE FROM concepto WHERE idConcepto = ?`, [
                req.query.idConcepto
            ]);

            await conec.commit(connection)
            return sendSuccess(res, 'Se eliminó correctamente el concepto.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/delete", error);
        }
    }

    async listcombo(req, res) {
        try {
            const result = await conec.query('SELECT idConcepto, nombre FROM concepto WHERE tipo = 2');
            return sendSuccess(res,result);;
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/listcombo", error);
        }
    }

    async listcombogasto(req, res) {
        try {
            let result = await conec.query('SELECT idConcepto, nombre FROM concepto WHERE tipo = 1');
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/listcombogasto", error);
        }
    }

    async filtrarCobro(req, res) {
        try {
            const result = await conec.query(`SELECT 
            idConcepto, 
            nombre 
            FROM concepto 
            WHERE tipo = 2 AND nombre LIKE concat(?,'%') AND sistema <> 1`,[
                req.query.filtrar,
            ]);
            return sendSuccess(res,result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/filtrarCobro", error);
        }
    }

    async filtrarGasto(req, res) {
        try {
            const result = await conec.query(`SELECT 
            idConcepto, 
            nombre 
            FROM concepto 
            WHERE tipo = 1 AND nombre LIKE concat(?,'%') AND sistema <> 1`,[
                req.query.filtrar,
            ]);
            return sendSuccess(res,result);;
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Concepto/Gasto", error);
        }
    }
}

module.exports = new Concepto();