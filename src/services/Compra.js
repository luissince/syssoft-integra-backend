const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Compra {

    async list(req) {
        try {
            const lista = await conec.query(`SELECT 
            a.idAjuste,
            DATE_FORMAT(a.fecha,'%d/%m/%Y') as fecha,
            a.hora,
            a.observacion,
            ta.nombre as ajuste,
            ma.nombre as motivo,
            a.estado,
            u.apellidos,
            u.nombres
            FROM ajuste AS a
            INNER JOIN tipoAjuste AS ta ON ta.idTipoAjuste = a.idTipoAjuste
            INNER JOIN motivoAjuste AS ma ON ma.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN usuario AS u ON u.idUsuario = a.idUsuario
            WHERE 
            ? = 0 AND a.idSucursal = ?
            OR
            ? = 1 AND a.idSucursal = ? AND a.observacion LIKE CONCAT(?,'%')
            OR
            ? = 2 AND a.idSucursal = ? AND a.fecha BETWEEN ? AND ?
            OR
            ? = 3 AND a.idSucursal = ? AND a.idTipoAjuste = ?
            ORDER BY a.fecha DESC, a.hora DESC
            LIMIT ?,?`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.fechaInicio,
                req.query.fechaFinal,

                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.idTipoAjuste,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`SELECT COUNT(*) AS Total
            FROM ajuste AS a
            INNER JOIN tipoAjuste AS ta ON ta.idTipoAjuste = a.idTipoAjuste
            INNER JOIN motivoAjuste AS ma ON ma.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN usuario AS u ON u.idUsuario = a.idUsuario
            WHERE 
            ? = 0 AND a.idSucursal = ?
            OR
            ? = 1 AND a.idSucursal = ? AND a.observacion LIKE CONCAT(?,'%')
            OR
            ? = 2 AND a.idSucursal = ? AND a.fecha BETWEEN ? AND ?
            OR
            ? = 3 AND a.idSucursal = ? AND a.idTipoAjuste = ?`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.fechaInicio,
                req.query.fechaFinal,

                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.idTipoAjuste,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            console.log(error)
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            console.log(req.query)
            const ajuste = await conec.query(`SELECT 
            a.idAjuste,
            DATE_FORMAT(a.fecha,'%d/%m/%Y') as fecha,
            a.hora,
            tp.nombre as tipo,
            mt.nombre as motivo,
            al.nombre as almacen,
            a.observacion,
            a.estado
            from ajuste as a 
            INNER JOIN tipoAjuste as tp ON tp.idTipoAjuste = a.idTipoAjuste
            INNER JOIN motivoAjuste as mt on mt.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN almacen as al on al.idAlmacen = a.idAlmacen
            INNER JOIN usuario us on us.idUsuario = a.idUsuario
            WHERE a.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const detalle = await conec.query(`SELECT 
            p.codigo,
            p.nombre as producto,
            aj.cantidad,
            m.nombre as unidad,
            c.nombre as categoria
            from ajusteDetalle as aj
            INNER JOIN producto as p on p.idProducto = aj.idProducto
            INNER JOIN medida as m on m.idMedida = p.idMedida
            INNER JOIN categoria as c on c.idCategoria = p.idCategoria
            WHERE aj.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            return { cabecera: ajuste[0], detalle };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }



    async detail(req) {
        try {
            console.log(req.query)
            const ajuste = await conec.query(`SELECT 
            a.idAjuste,
            DATE_FORMAT(a.fecha,'%d/%m/%Y') as fecha,
            a.hora,
            tp.nombre as tipo,
            mt.nombre as motivo,
            al.nombre as almacen,
            a.observacion,
            a.estado
            from ajuste as a 
            INNER JOIN tipoAjuste as tp ON tp.idTipoAjuste = a.idTipoAjuste
            INNER JOIN motivoAjuste as mt on mt.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN almacen as al on al.idAlmacen = a.idAlmacen
            INNER JOIN usuario us on us.idUsuario = a.idUsuario
            WHERE a.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const detalle = await conec.query(`SELECT 
            p.codigo,
            p.nombre as producto,
            aj.cantidad,
            m.nombre as unidad,
            c.nombre as categoria
            from ajusteDetalle as aj
            INNER JOIN producto as p on p.idProducto = aj.idProducto
            INNER JOIN medida as m on m.idMedida = p.idMedida
            INNER JOIN categoria as c on c.idCategoria = p.idCategoria
            WHERE aj.idAjuste = ?`, [
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
                idComprobante,
                idCliente,
                idUsuario,
                idSucursal,
                idMoneda,
                observacion,
                nota,
                detalle,
                metodoPago
            } = req.body;

            /**
            * Generar un código unico para el compra. 
            */
            const resultCompra = await conec.execute(connection, 'SELECT idCompra FROM compra');
            const idCompra = generateAlphanumericCode("CP0001", resultCompra, 'idCompra');

            /**
            * Obtener la serie y numeración del comprobante.
            */

            const comprobante = await conec.execute(connection, `SELECT 
                serie,
                numeracion 
                FROM comprobante 
                WHERE idComprobante  = ?
            `, [
                idComprobante
            ]);

            const compras = await conec.execute(connection, `SELECT 
                numeracion  
                FROM compra 
                WHERE idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, compras, "numeracion");

            /**
             * Proceso para ingresar la compra.
             */

            // Proceso de registro
            await conec.execute(connection, `INSERT INTO compra(
                idCompra,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,
                observacion,
                nota,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idCompra,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                comprobante[0].serie,
                numeracion,
                observacion,
                nota,
                currentDate(),
                currentTime()
            ]);

            /**
             * Proceso para ingresar el detalle de la compra.
             */

            // Generar el Id único
            const listaCompraDetalle = await conec.execute(connection, 'SELECT idCompraDetalle FROM compraDetalle');
            let idCompraDetalle = generateNumericCode(1, listaCompraDetalle, 'idCompraDetalle');

            // Proceso de registro  
            for (const item of detalle) {
                await await conec.execute(connection, `INSERT INTO compraDetalle(
                    idCompraDetalle,
                    idCompra,
                    idProducto,
                    costo,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?)`, [
                    idCompraDetalle,
                    idCompra,
                    item.idProducto,
                    item.costo,
                    item.cantidad,
                    item.idImpuesto
                ])

                idCompraDetalle++;
            }

            /**
            * Proceso para registrar la lista de salidas con sus método de pagos
            */

            // Generar el Id único
            const listSalidas = await conec.execute(connection, 'SELECT idSalida FROM salida');
            let idSalida = generateNumericCode(1, listSalidas, 'idSalida');

            // Proceso de registro  
            for (const item of metodoPago) {
                await conec.execute(connection, `INSERT INTO salida(
                    idSalida,
                    idCompra,
                    idGasto,
                    idMetodoPago,
                    monto,
                    descripcion,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                    idSalida,
                    idCompra,
                    null,
                    item.idMetodoPago,
                    item.monto,
                    item.descripcion,
                    1,
                    currentDate(),
                    currentTime(),
                    idUsuario
                ])

                idSalida++;
            }

            console.log(req.body)

            /**
            * Proceso de registrar datos en la tabla auditoria para tener un control de los movimientos echos.
            */

            // Generar el Id único
            const listaAuditoriaId = await conec.execute(connection, 'SELECT idAuditoria FROM auditoria');
            const idAuditoria = generateNumericCode(1, listaAuditoriaId, 'idAuditoria');

            // Proceso de registro            
            await conec.execute(connection, `INSERT INTO auditoria(
                idAuditoria,
                idProcedencia,
                descripcion,
                fecha,
                hora,
                idUsuario) 
                VALUES(?,?,?,?,?,?)`, [
                idAuditoria,
                idCompra,
                `REGSITRO DE COMPRA ${comprobante[0].serie}-${numeracion}`,
                currentDate(),
                currentTime(),
                idUsuario
            ]);

            await conec.commit(connection);
            return "create";
        } catch (error) {
            console.log(error)
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

            console.log(req.query)

            const exist = await conec.execute(connection, `SELECT * FROM ajuste WHERE idAjuste = ? AND estado = 0`, [
                req.query.idAjuste,
            ])

            if (exist.length !== 0) {
                await conec.rollback(connection);
                return "El ajuste ya se encuentra cancelado."
            }

            const ajuste = await conec.execute(connection, `SELECT idTipoAjuste,idAlmacen FROM ajuste WHERE idAjuste = ?`, [
                req.query.idAjuste,
            ])

            console.log(ajuste)

            await conec.execute(connection, `UPDATE ajuste SET estado = 0 WHERE idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const ajusteDetalle = await conec.execute(connection, `SELECT idProducto,cantidad FROM ajusteDetalle WHERE idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            for (const item of ajusteDetalle) {
                const inventario = await conec.execute(connection, `SELECT idInventario FROM inventario 
                WHERE idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    ajuste[0].idAlmacen,
                ]);

                const producto = await conec.execute(connection, `SELECT costo FROM producto WHERE idProducto = ?`, [
                    item.idProducto,
                ]);

                if (ajuste[0].idTipoAjuste === "TA0001") {
                    await conec.execute(connection, `INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        hora,
                        fecha,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0002',
                        'MK0002',
                        'ANULAR AJUSTE DE INGRESO',
                        item.cantidad,
                        producto[0].costo,
                        ajuste[0].idAlmacen,
                        currentTime(),
                        currentDate(),
                        req.query.idUsuario
                    ]);

                    await conec.execute(connection, `UPDATE inventario SET 
                    cantidad = cantidad - ?
                    WHERE idInventario = ?`, [
                        item.cantidad,
                        inventario[0].idInventario
                    ]);
                } else {
                    await conec.execute(connection, `INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        hora,
                        fecha,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0001',
                        'MK0002',
                        'ANULAR AJUSTE DE SALIDA',
                        item.cantidad,
                        producto[0].costo,
                        ajuste[0].idAlmacen,
                        currentTime(),
                        currentDate(),
                        req.query.idUsuario
                    ]);

                    await conec.execute(connection, `UPDATE inventario SET 
                    cantidad = cantidad + ?
                    WHERE idInventario = ?`, [
                        item.cantidad,
                        inventario[0].idInventario
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

module.exports = Compra;