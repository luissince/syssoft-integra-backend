const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const FirebaseService = require('../tools/FiraseBaseService');
const firebaseService = new FirebaseService();

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
            ]);

            const detalles = await conec.query(`
            SELECT 
                p.codigo,
                p.nombre as producto,
                p.imagen,
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
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map((item, index) => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        id: index + 1,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                    id: index + 1,
                }
            });

            return { cabecera: ajuste[0], detalles: listaDetalles };
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
                idUsuario,
                detalles
            } = req.body;

            const date = currentDate();
            const time = currentTime();

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
                fecha, 
                hora, 
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?)`, [
                idAjuste,
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                date,
                time,
                idUsuario
            ]);

            const detalleIds = await conec.execute(connection, 'SELECT idAjusteDetalle FROM ajusteDetalle');
            let idAjusteDetalle = generateNumericCode(1, detalleIds, 'idAjusteDetalle');

            const kardexIds = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            const tipoKardex = idTipoAjuste === "TA0001" ? "TK0001" : "TK0002";
            const motivoKardex = "MK0002";
            const detalleKardex = idTipoAjuste === "TA0001" ? "INGRESO POR AJUSTE" : "SALIDA POR AJUSTE";
            const operacion = idTipoAjuste === "TA0001" ? 1 : -1;

            for (const item of detalles) {
                const cantidad = item.lotes
                    ? item.lotes.reduce((acc, lote) => acc + Number(lote.cantidadAjustar), 0)
                    : Number(item.cantidad);

                await conec.execute(connection, `
                INSERT INTO ajusteDetalle(
                    idAjusteDetalle, 
                    idAjuste, 
                    idProducto, 
                    cantidad
                ) VALUES(?,?,?,?)`, [
                    idAjusteDetalle++,
                    idAjuste,
                    item.idProducto,
                    cantidad
                ]);

                const [{ idInventario }] = await conec.execute(connection, `
                SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto, idAlmacen
                ]);

                const [{ costo }] = await conec.execute(connection, `
                SELECT 
                    costo 
                FROM 
                    producto 
                WHERE 
                    idProducto = ?`, [
                    item.idProducto
                ]);

                const insertarKardex = async (loteId = null, cantidadAjuste = cantidad) => {

                    if (loteId) {
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
                            idLote,
                            fecha, 
                            hora, 
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            item.idProducto,
                            tipoKardex,
                            motivoKardex,
                            idAjuste,
                            detalleKardex,
                            cantidadAjuste,
                            costo,
                            idAlmacen,
                            idInventario,
                            loteId,
                            date,
                            time,
                            idUsuario
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
                            fecha, 
                            hora, 
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            item.idProducto,
                            tipoKardex,
                            motivoKardex,
                            idAjuste,
                            detalleKardex,
                            cantidadAjuste,
                            costo,
                            idAlmacen,
                            idInventario,
                            date,
                            time,
                            idUsuario
                        ]);
                    }
                };

                if (item.lotes) {
                    for (const lote of item.lotes) {
                        await conec.execute(connection, `
                        UPDATE 
                            lote 
                        SET 
                            cantidad = cantidad + ? 
                        WHERE 
                            idLote = ?`, [
                            lote.cantidadAjustar * operacion,
                            lote.idLote
                        ]);
                        await insertarKardex(lote.idLote, lote.cantidadAjustar);
                    }
                } else {
                    await insertarKardex();
                }

                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad + ? 
                WHERE 
                    idInventario = ?`, [
                    cantidad * operacion,
                    idInventario
                ]);
            }

            await conec.commit(connection);
            return "create";
        } catch (error) {
            if (connection) await conec.rollback(connection);

            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            // Obtener ajuste
            const [ajuste] = await conec.execute(connection, `
            SELECT idTipoAjuste, idAlmacen, estado 
            FROM ajuste 
            WHERE idAjuste = ?`, [req.query.idAjuste]);

            if (!ajuste) {
                await conec.rollback(connection);
                return "El ajuste no existe, verifique el código o actualiza la lista.";
            }

            if (ajuste.estado === 0) {
                await conec.rollback(connection);
                return "El ajuste ya se encuentra con estado cancelado.";
            }

            // Cancelar ajuste
            await conec.execute(connection, `
            UPDATE ajuste SET estado = 0 WHERE idAjuste = ?`, [req.query.idAjuste]);


            // Obtener detalles del ajuste
            const ajusteDetalles = await conec.execute(connection, `
            SELECT idProducto, cantidad FROM ajusteDetalle WHERE idAjuste = ?`, [req.query.idAjuste]);

            // Obtener ID kardex siguiente
            const resultKardex = await conec.execute(connection, `SELECT idKardex FROM kardex`);
            let idKardex = resultKardex.length > 0
                ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", ''))))
                : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Determinar operación inversa
            const tipoKardex = ajuste.idTipoAjuste === "TA0001" ? "TK0002" : "TK0001";
            const detalleKardex = ajuste.idTipoAjuste === "TA0001" ? "ANULAR AJUSTE DE INGRESO" : "ANULAR AJUSTE DE SALIDA";
            const operacion = ajuste.idTipoAjuste === "TA0001" ? -1 : 1;

            // Funciones reutilizables
            const insertarKardex = async (k, cantidad) => {
                if (k.idLote) {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex, idProducto, idTipoKardex, idMotivoKardex, idAjuste, detalle,
                        cantidad, costo, idAlmacen, idInventario, idLote, fecha, hora, idUsuario
                    ) VALUES (
                        ?,?,?,?,?,?,
                        ?,?,?,?,?,?,?,?
                    )`, [
                        generarIdKardex(), k.idProducto, tipoKardex, 'MK0002', req.query.idAjuste, detalleKardex,
                        cantidad, k.costo, k.idAlmacen, k.idInventario, k.idLote, date, time, req.query.idUsuario
                    ]);
                } else {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex, idProducto, idTipoKardex, idMotivoKardex, idAjuste, detalle,
                        cantidad, costo, idAlmacen, idInventario, fecha, hora, idUsuario
                    ) VALUES (
                        ?,?,?,?,?,?,
                        ?,?,?,?,?,?,?
                    )`, [
                        generarIdKardex(), k.idProducto, tipoKardex, 'MK0002', req.query.idAjuste, detalleKardex,
                        cantidad, k.costo, k.idAlmacen, k.idInventario, date, time, req.query.idUsuario
                    ]);
                }

            };

            const actualizarInventario = async (idInventario, cantidad) => {
                await conec.execute(connection, `
                UPDATE inventario SET cantidad = cantidad + ? WHERE idInventario = ?`,
                    [cantidad * operacion, idInventario]
                );
            };

            const actualizarLote = async (idLote, cantidad) => {
                await conec.execute(connection, `
                UPDATE lote SET cantidad = cantidad + ? WHERE idLote = ?`,
                    [cantidad * operacion, idLote]
                );
            };

            // Procesar cada detalle
            for (const item of ajusteDetalles) {
                const kardexes = await conec.execute(connection, `
                    SELECT idProducto, cantidad, costo, idAlmacen, idInventario, idLote
                    FROM kardex 
                    WHERE idAjuste = ? AND idProducto = ?`, [req.query.idAjuste, item.idProducto]);

                for (const k of kardexes) {
                    if (k.idLote) await actualizarLote(k.idLote, k.cantidad);
                    await insertarKardex(k, k.cantidad);
                    await actualizarInventario(k.idInventario, k.cantidad);
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