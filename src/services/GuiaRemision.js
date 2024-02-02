const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class GuiaRemision {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Guia_Remision(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Guia_Remision_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
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
            const guiaRemision = await conec.procedure(`CALL Guia_Remision_Por_Id(?)`, [
                req.query.idGuiaRemision,
            ])

            const detalle = await conec.procedure(`CALL Guia_Remision_Detalle_Por_Id(?)`, [
                req.query.idGuiaRemision,
            ])

            return { cabecera: guiaRemision[0], detalle };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idVenta,
                idSucursal,
                idComprobante,
                idModalidadTraslado,
                idMotivoTraslado,
                fechaTraslado,
                idTipoPeso,
                peso,
                idVehiculo,
                idConductor,
                direccionPartida,
                idUbigeoPartida,
                direccionLlegada,
                idUbigeoLlegada,
                estado,
                idUsuario,
                detalle
            } = req.body;

            const result = await conec.execute(connection, 'SELECT idGuiaRemision FROM guiaRemision');
            const idGuiaRemision = generateAlphanumericCode("GR0001", result, 'idGuiaRemision');

            const comprobante = await conec.execute(connection, `SELECT 
            serie,
            numeracion 
            FROM comprobante 
            WHERE idComprobante  = ?`, [
                idComprobante
            ]);

            const guiaRemisions = await conec.execute(connection, `SELECT 
            numeracion  
            FROM guiaRemision 
            WHERE idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, guiaRemisions, "numeracion");

            await conec.execute(connection, `INSERT INTO guiaRemision(
                idGuiaRemision,
                idSucursal,
                idVenta,                
                idComprobante,
                serie,
                numeracion,
                idModalidadTraslado,
                idMotivoTraslado,
                fechaTraslado,
                idTipoPeso,
                peso,
                idVehiculo,
                idConductor,
                direccionPartida,
                idUbigeoPartida,
                direccionLlegada,
                idUbigeoLlegada,
                fecha,
                hora,
                estado,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idGuiaRemision,
                idSucursal,
                idVenta,
                idComprobante,
                comprobante[0].serie,
                numeracion,
                idModalidadTraslado,
                idMotivoTraslado,
                fechaTraslado,
                idTipoPeso,
                peso,
                idVehiculo,
                idConductor,
                direccionPartida,
                idUbigeoPartida,
                direccionLlegada,
                idUbigeoLlegada,
                currentDate(),
                currentTime(),
                estado,
                idUsuario
            ]);

            const listaGuiaRemision = await conec.execute(connection, 'SELECT idGuiaRemisionDetalle FROM guiaRemisionDetalle');
            let idGuiaRemisionDetalle = generateNumericCode(1, listaGuiaRemision, 'idGuiaRemisionDetalle');

            for (const producto of detalle) {
                await conec.execute(connection, `INSERT INTO guiaRemisionDetalle(
                    idGuiaRemisionDetalle,
                    idGuiaRemision,
                    idProducto,
                    cantidad
                ) VALUES (?,?,?,?)`, [
                    idGuiaRemisionDetalle,
                    idGuiaRemision,
                    producto.idProducto,
                    producto.cantidad
                ]);

                idGuiaRemisionDetalle++;
            }

            await conec.commit(connection);
            return {
                message: "Se registró correctamente la guían de remisión.",
                idGuiaRemision: idGuiaRemision
            };
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idAjuste FROM ajuste');
            const idAjuste = generateAlphanumericCode("AJ0001", result, 'idAjuste');

            await conec.execute(connection, `INSERT INTO ajuste(
                idAjuste,
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                estado,
                fecha,
                hora,
                idUsuario) 
                VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                idAjuste,
                req.body.idTipoAjuste,
                req.body.idMotivoAjuste,
                req.body.idAlmacen,
                req.body.idSucursal,
                req.body.observacion,
                1,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ])

            const resultVentaDetalle = await conec.execute(connection, 'SELECT idAjusteDetalle FROM ajusteDetalle');
            let idAjusteDetalle = generateNumericCode(1, resultVentaDetalle, 'idAjusteDetalle');

            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            for (const item of req.body.detalle) {
                await conec.execute(connection, `INSERT INTO ajusteDetalle(
                    idAjusteDetalle,
                    idAjuste,
                    idProducto,
                    cantidad) 
                    VALUES(?,?,?,?)`, [
                    idAjusteDetalle,
                    idAjuste,
                    item.idProducto,
                    item.cantidad
                ])

                idAjusteDetalle++;

                const inventario = await conec.execute(connection, `SELECT idInventario FROM inventario 
                WHERE idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    req.body.idAlmacen,
                ]);

                const producto = await conec.execute(connection, `SELECT costo FROM producto WHERE idProducto = ?`, [
                    item.idProducto,
                ]);

                if (req.body.idTipoAjuste === "TA0001") {
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
                        'INGRESO POR AJUSTE',
                        item.cantidad,
                        producto[0].costo,
                        req.body.idAlmacen,
                        currentTime(),
                        currentDate(),
                        req.body.idUsuario
                    ]);

                    await conec.execute(connection, `UPDATE inventario SET 
                    cantidad = cantidad + ?
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
                        'TK0002',
                        'MK0002',
                        'SALIDA POR AJUSTE',
                        item.cantidad,
                        producto[0].costo,
                        req.body.idAlmacen,
                        currentTime(),
                        currentDate(),
                        req.body.idUsuario
                    ]);

                    await conec.execute(connection, `UPDATE inventario SET 
                    cantidad = cantidad - ?
                    WHERE idInventario = ?`, [
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

module.exports = GuiaRemision;