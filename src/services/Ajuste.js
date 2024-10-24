const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Ajuste {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Ajuste(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idTipoAjuste,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Ajuste_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idTipoAjuste,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }


    async detail(req) {
        try {
            const ajuste = await conec.query(`
            SELECT 
                a.idAjuste,
                DATE_FORMAT(a.fecha,'%d/%m/%Y') as fecha,
                a.hora,
                tp.nombre as tipo,
                mt.nombre as motivo,
                al.nombre as almacen,
                a.observacion,
                a.estado
            FROM 
                ajuste as a 
            INNER JOIN 
                tipoAjuste as tp ON tp.idTipoAjuste = a.idTipoAjuste
            INNER JOIN 
                motivoAjuste as mt on mt.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN 
                almacen as al on al.idAlmacen = a.idAlmacen
            INNER JOIN 
                usuario us on us.idUsuario = a.idUsuario
            WHERE 
                a.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const detalle = await conec.query(`
            SELECT 
                p.codigo,
                p.nombre as producto,
                aj.cantidad,
                m.nombre as unidad,
                c.nombre as categoria
            FROM 
                ajusteDetalle as aj
            INNER JOIN 
                producto as p on p.idProducto = aj.idProducto
            INNER JOIN 
                medida as m on m.idMedida = p.idMedida
            INNER JOIN 
                categoria as c on c.idCategoria = p.idCategoria
            WHERE 
                aj.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            return { cabecera: ajuste[0], detalle };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                idUsuario
            } = req.body;

            const result = await conec.execute(connection, 'SELECT idAjuste FROM ajuste');
            const idAjuste = generateAlphanumericCode("AJ0001", result, 'idAjuste');

            await conec.execute(connection, `
            INSERT INTO ajuste(
                idAjuste,
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                estado,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                idAjuste,
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                1,
                currentDate(),
                currentTime(),
                idUsuario,
            ]);

            const resultVentaDetalle = await conec.execute(connection, 'SELECT idAjusteDetalle FROM ajusteDetalle');
            let idAjusteDetalle = generateNumericCode(1, resultVentaDetalle, 'idAjusteDetalle');

            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            for (const item of req.body.detalle) {
                await conec.execute(connection, `
                INSERT INTO ajusteDetalle(
                    idAjusteDetalle,
                    idAjuste,
                    idProducto,
                    cantidad
                ) VALUES(?,?,?,?)`, [
                    idAjusteDetalle,
                    idAjuste,
                    item.idProducto,
                    item.cantidad
                ])

                idAjusteDetalle++;

                const inventario = await conec.execute(connection, `SELECT 
                    idInventario 
                    FROM inventario 
                    WHERE idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacen,
                ]);

                const producto = await conec.execute(connection, `SELECT costo FROM producto WHERE idProducto = ?`, [
                    item.idProducto,
                ]);

                if (idTipoAjuste === "TA0001") {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idAjuste,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        hora,
                        fecha,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0001',
                        'MK0002',
                        idAjuste,
                        'INGRESO POR AJUSTE',
                        item.cantidad,
                        producto[0].costo,
                        idAlmacen,
                        inventario[0].idInventario,
                        currentTime(),
                        currentDate(),
                        idUsuario
                    ]);

                    await conec.execute(connection, `
                    UPDATE 
                        inventario 
                    SET 
                        cantidad = cantidad + ?
                    WHERE 
                        idInventario = ?`, [
                        item.cantidad,
                        inventario[0].idInventario
                    ]);
                } else {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idAjuste,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        hora,
                        fecha,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0002',
                        'MK0002',
                        idAjuste,
                        'SALIDA POR AJUSTE',
                        item.cantidad,
                        producto[0].costo,
                        idAlmacen,
                        inventario[0].idInventario,
                        currentTime(),
                        currentDate(),
                        idUsuario
                    ]);

                    await conec.execute(connection, `
                    UPDATE 
                        inventario 
                    SET 
                        cantidad = cantidad - ?
                    WHERE 
                        idInventario = ?`, [
                        item.cantidad,
                        inventario[0].idInventario
                    ]);
                }
            }

            await conec.commit(connection);
            return "create";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const ajuste = await conec.execute(connection, `
            SELECT 
                idTipoAjuste,
                idAlmacen,
                estado 
            FROM 
                ajuste 
            WHERE 
                idAjuste = ?`, [
                req.query.idAjuste,
            ])

            if (ajuste.length === 0) {
                await conec.rollback(connection);
                return "El ajuste no existe, verifique el código o actualiza la lista."
            }

            if (ajuste[0].estado === 0) {
                await conec.rollback(connection);
                return "El ajuste ya se encuentra con estado cancelado."
            }

            await conec.execute(connection, `
            UPDATE 
                ajuste 
            SET 
                estado = 0 
            WHERE 
                idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const ajusteDetalle = await conec.execute(connection, `
            SELECT 
                idProducto,
                cantidad 
            FROM 
                ajusteDetalle 
            WHERE 
                idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const resultKardex = await conec.execute(connection, `
            SELECT 
                idKardex 
            FROM 
                kardex`);
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            for (const item of ajusteDetalle) {
                const kardex = await conec.execute(connection, `
                SELECT 
                    k.idProducto,
                    k.cantidad,
                    k.costo,
                    k.idAlmacen,
                    k.idInventario    
                FROM 
                    kardex AS k 
                WHERE 
                    k.idAjuste = ? AND k.idProducto = ?`, [
                    req.query.idAjuste,
                    item.idProducto,
                ]);

                if (ajuste[0].idTipoAjuste === "TA0001") {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idAjuste,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        hora,
                        fecha,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0002',
                        'MK0002',
                        req.query.idAjuste,
                        'ANULAR AJUSTE DE INGRESO',
                        kardex[0].cantidad,
                        kardex[0].costo,
                        kardex[0].idAlmacen,
                        kardex[0].idInventario,
                        currentTime(),
                        currentDate(),
                        req.query.idUsuario
                    ]);

                    await conec.execute(connection, `
                    UPDATE 
                        inventario 
                    SET 
                        cantidad = cantidad - ?
                    WHERE 
                        idInventario = ?`, [
                        kardex[0].cantidad,
                        kardex[0].idInventario
                    ]);
                } else {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idAjuste,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        hora,
                        fecha,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0001',
                        'MK0002',
                        req.query.idAjuste,
                        'ANULAR AJUSTE DE SALIDA',
                        kardex[0].cantidad,
                        kardex[0].costo,
                        kardex[0].idAlmacen,
                        kardex[0].idInventario,
                        currentTime(),
                        currentDate(),
                        req.query.idUsuario
                    ]);

                    await conec.execute(connection, `
                    UPDATE 
                        inventario 
                    SET 
                        cantidad = cantidad + ?
                    WHERE 
                        idInventario = ?`, [
                        kardex[0].cantidad,
                        kardex[0].idInventario
                    ]);
                }
            }

            await conec.commit(connection);
            return "cancel";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = Ajuste;