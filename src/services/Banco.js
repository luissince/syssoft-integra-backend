const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Banco {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Bancos(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`SELECT COUNT(*) AS Total 
            FROM banco AS b INNER JOIN moneda AS m
            ON m.idMoneda = b.idMoneda 
            WHERE 
            ? = 0
            OR
            ? = 1 and b.nombre like concat(?,'%')`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async add(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idBanco FROM banco');
            const idBanco = generateAlphanumericCode("BC0001", result, 'idBanco');

            await conec.execute(connection, `INSERT INTO banco(
                idBanco,
                nombre,
                tipoCuenta,
                idMoneda,
                numCuenta,
                cci, 
                preferido,
                vuelto,
                estado,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idBanco,
                req.body.nombre,
                req.body.tipoCuenta,
                req.body.idMoneda,
                req.body.numCuenta,
                req.body.cci,
                req.body.preferido,
                req.body.vuelto,
                req.body.estado,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario
            ]);

            await conec.commit(connection);
            return "insert";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            let result = await conec.query('SELECT * FROM banco WHERE idBanco = ?', [
                req.query.idBanco,
            ]);

            if (result.length > 0) {
                return result[0];
            } else {
                return "Datos no encontrados";
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detail(req){
        try{
            console.log( req.query.idBanco,)
            const banco = await conec.query(`SELECT 
            ba.nombre,
            ba.tipoCuenta,
            ba.numCuenta,
            ba.cci,
            ba.estado,
            mo.nombre as moneda,
            mo.codiso
            from banco as ba
            INNER JOIN moneda as mo ON ba.idMoneda = mo.idMoneda
            WHERE ba.idBanco = ?`,[
                req.query.idBanco,
            ])

            const total = await conec.query(`
            SELECT 
                IFNULL(SUM(CASE 
                WHEN tipo = 1 THEN monto
                ELSE  -monto
            END),0) AS monto 
            FROM bancoDetalle
            WHERE idBanco = ? AND estado = 1`,[
                req.query.idBanco,
            ])

            const detalle = await conec.query(`SELECT 
            DATE_FORMAT(fecha,'%d/%m/%Y') AS fecha, 
            hora,
            tipo,
            estado,
            monto
            FROM bancoDetalle
            WHERE idBanco = ?
            ORDER BY fecha DESC, hora DESC`,[
                req.query.idBanco,
            ])

            return {
                "banco":banco[0],
                "monto":total[0].monto,
                detalle
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();
            await conec.execute(connection, `UPDATE banco SET 
                nombre=?, 
                tipoCuenta=?, 
                idMoneda=?, 
                numCuenta=?, 
                cci=?, 
                fecha=?,
                hora=?,
                idUsuario=?
            WHERE 
                idBanco=?`, [
                req.body.nombre,
                req.body.tipoCuenta,
                req.body.idMoneda,
                req.body.numCuenta,
                req.body.cci,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idBanco
            ]);

            await conec.commit(connection);
            return "update";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async delete(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const cobro = await conec.execute(connection, `SELECT * FROM cobro WHERE idBanco = ?`, [
                req.query.idBanco
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el banco ya que esta ligada a un cobro.';
            }

            const gasto = await conec.execute(connection, `SELECT * FROM gasto WHERE idBanco = ?`, [
                req.query.idBanco
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el banco ya que esta ligada a un gasto.';
            }

            await conec.execute(connection, `DELETE FROM banco WHERE idBanco = ?`, [
                req.query.idBanco
            ]);

            await conec.commit(connection);
            return "delete";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async combo() {
        try {
            const result = await conec.query(`
            SELECT 
                idBanco, 
                nombre, 
                preferido,
                vuelto 
            FROM 
                banco   
            WHERE 
                estado = 1`);
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async idDetalle(req) {
        try {
            const cabecera = await conec.query(`SELECT 
            b.idBanco,
            b.nombre, 
            CASE 
            WHEN b.tipoCuenta = 1 THEN 'Banco'
            WHEN b.tipoCuenta = 2 THEN 'Tarjeta'
            ELSE 'Efectivo' END AS 'tipoCuenta',
            m.nombre as moneda,
            m.codiso,
            b.numCuenta,
            b.cci,
            IFNULL(SUM(CASE WHEN bd.tipo = 1 THEN bd.monto ELSE -bd.monto END),0)AS saldo
            FROM banco AS b 
            INNER JOIN moneda AS m ON m.idMoneda = b.idMoneda 
            LEFT JOIN bancoDetalle AS bd ON bd.idBanco = b.idBanco 
            WHERE b.idBanco = ?`, [
                req.query.idBanco
            ])

            return { "cabecera": cabecera[0] };
        } catch (error) {
            return 'Error interno de conexión, intente nuevamente.'
        }
    }

    async detalleBanco(req) {
        try {

            const lista = await conec.query(`SELECT 
            DATE_FORMAT(bd.fecha,'%d/%m/%Y') as fecha, 
            bd.hora,
            IFNULL(cl.informacion,IFNULL(cf.informacion,'')) AS proveedor,
            IFNULL(CONCAT(cc.nombre,' ',c.serie,'-',c.numeracion), CONCAT(cg.nombre,' ',g.serie,'-',g.numeracion)) AS cuenta,
            bd.tipo,
            SUM(CASE WHEN bd.tipo = 1 THEN bd.monto ELSE 0 END ) AS ingreso,
            SUM(CASE WHEN bd.tipo = 0 THEN bd.monto ELSE 0 END ) AS salida
            FROM bancoDetalle AS bd 
            INNER JOIN banco AS b ON b.idBanco = bd.idBanco
            LEFT JOIN cobro AS c ON c.idCobro = bd.idProcedencia     
            LEFT JOIN persona AS cl ON cl.idPersona = c.idPersona
            LEFT JOIN comprobante AS cc ON cc.idComprobante = c.idComprobante
            LEFT JOIN gasto AS g ON g.idGasto = bd.idProcedencia
            LEFT JOIN persona AS cf ON cf.idPersona = g.idPersona
            LEFT JOIN comprobante AS cg ON cg.idComprobante = g.idComprobante
            
            WHERE bd.idBanco = ?
            GROUP BY bd.idBanco,bd.idProcedencia
            ORDER BY bd.fecha DESC,bd.hora DESC
            LIMIT ?,?`, [
                req.query.idBanco,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`SELECT COUNT(*) AS Total
            FROM bancoDetalle AS bd 
            INNER JOIN banco AS b ON b.idBanco = bd.idBanco
            LEFT JOIN cobro AS c ON c.idCobro = bd.idProcedencia     
            LEFT JOIN persona AS cl ON cl.idPersona = c.idPersona
            LEFT JOIN comprobante AS cc ON cc.idComprobante = c.idComprobante
            LEFT JOIN gasto AS g ON g.idGasto = bd.idProcedencia
            LEFT JOIN persona AS cf ON cf.idPersona = g.idPersona
            LEFT JOIN comprobante AS cg ON cg.idComprobante = g.idComprobante            
            WHERE bd.idBanco = ?`, [
                req.query.idBanco
            ])

            return { "lista": resultLista, "total": total[0].Total };
        } catch (error) {
            return 'Error interno de conexión, intente nuevamente.'
        }
    }

    async detalleBancoReporte(req) {
        try {
            const cabecera = await conec.query(`SELECT 
            b.idBanco,
            b.nombre, 
            CASE 
            WHEN b.tipoCuenta = 1 THEN 'Banco'
            WHEN b.tipoCuenta = 2 THEN 'Tarjeta'
            ELSE 'Efectivo' END AS 'tipoCuenta',
            m.nombre as moneda,
            m.codiso,
            b.numCuenta,
            b.cci,
            IFNULL(SUM(CASE WHEN bd.tipo = 1 THEN bd.monto ELSE -bd.monto END),0)AS saldo
            FROM banco AS b 
            INNER JOIN moneda AS m ON m.idMoneda = b.idMoneda 
            LEFT JOIN bancoDetalle AS bd ON bd.idBanco = b.idBanco 
            WHERE b.idBanco = ?`, [
                req.query.idBanco
            ])

            const lista = await conec.query(`SELECT 
            DATE_FORMAT(bd.fecha,'%d/%m/%Y') as fecha, 
            bd.hora,
            IFNULL(cl.informacion,IFNULL(cf.informacion,'')) AS proveedor,
            IFNULL(CONCAT(cc.nombre,' ',c.serie,'-',c.numeracion),CONCAT(cg.nombre,' ',g.serie,'-',g.numeracion)) AS cuenta,
            bd.tipo,
            SUM(CASE WHEN bd.tipo = 1 THEN bd.monto ELSE 0 END ) AS ingreso,
            SUM(CASE WHEN bd.tipo = 0 THEN bd.monto ELSE 0 END ) AS salida
            FROM bancoDetalle AS bd 
            INNER JOIN banco AS b ON b.idBanco = bd.idBanco
            LEFT JOIN cobro AS c ON c.idCobro = bd.idProcedencia     
            LEFT JOIN persona AS cl ON cl.idPersona = c.idPersona
            LEFT JOIN comprobante AS cc ON cc.idComprobante = c.idComprobante
            LEFT JOIN gasto AS g ON g.idGasto = bd.idProcedencia
            LEFT JOIN persona AS cf ON cf.idPersona = g.idPersona
            LEFT JOIN comprobante AS cg ON cg.idComprobante = g.idComprobante
            
            WHERE bd.idBanco = ?
            GROUP BY bd.idBanco,bd.idProcedencia
            ORDER BY bd.fecha DESC,bd.hora DESC`, [
                req.query.idBanco
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            return { "cabecera": cabecera[0], "lista": resultLista };
        } catch (error) {
            return 'Error interno de conexión, intente nuevamente.'
        }
    }

}

module.exports = Banco;