const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const FirebaseService = require('../tools/FiraseBaseService');
const firebaseService = new FirebaseService();


class Traslado {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Traslado(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                req.query.idTipoTraslado,
                req.query.fechaInicio,
                req.query.fechaFinal,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Traslado_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                req.query.idTipoTraslado,
                req.query.fechaInicio,
                req.query.fechaFinal,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }


    async detail(req) {
        try {
            const traslado = await conec.query(`
            SELECT 
                a.idTraslado,
                DATE_FORMAT(a.fecha, '%d/%m/%Y') AS fecha,
                a.hora,
                a.observacion,
                tt.nombre AS tipo,
                mt.nombre AS motivo,
                alo.nombre AS almacenOrigen,
                ald.nombre AS almacenDestino,
                COALESCE(sd.nombre, '') AS sucursalDestino,
                a.estado,
                CONCAT(u.nombres, ', ', u.apellidos) AS usuarioNombre
            FROM 
                traslado AS a
            INNER JOIN 
                tipoTraslado AS tt ON tt.idTipoTraslado = a.idTipoTraslado
            INNER JOIN 
                motivoTraslado AS mt ON mt.idMotivoTraslado = a.idMotivoTraslado
            INNER JOIN 
                usuario AS u ON u.idUsuario = a.idUsuario
            INNER JOIN 
                almacen AS alo ON alo.idAlmacen = a.idAlmacenOrigen
            INNER JOIN 
                almacen AS ald ON ald.idAlmacen = a.idAlmacenDestino
            LEFT JOIN 
                sucursal AS sd ON sd.idSucursal = a.idSucursalDestino
            WHERE 
                a.idTraslado = ?`, [
                req.query.idTraslado,
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
                trasladoDetalle as aj
            INNER JOIN 
                producto as p on p.idProducto = aj.idProducto
            INNER JOIN 
                medida as m on m.idMedida = p.idMedida
            INNER JOIN 
                categoria as c on c.idCategoria = p.idCategoria
            WHERE 
                aj.idTraslado = ?`, [
                req.query.idTraslado,
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

            return { cabecera: traslado[0], detalles: listaDetalles };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            // Inicia una transacción de la base de datos
            connection = await conec.beginTransaction();

            // Extrae los datos relevantes de la solicitud
            const {
                idTipoTraslado,
                idMotivoTraslado,
                idAlmacenOrigen,
                idAlmacenDestino,
                idSucursalDestino,
                idSucursal,
                observacion,
                idUsuario,
                detalles
            } = req.body;

            // Obtener fechas actuales
            const date = currentDate();
            const time = currentTime();

            // Genera un nuevo código alfanumérico para el traslado
            const result = await conec.execute(connection, 'SELECT idTraslado FROM traslado');
            const idTraslado = generateAlphanumericCode("TL0001", result, 'idTraslado');

            // Inserta un nuevo registro en la tabla traslado
            await conec.execute(connection, `
            INSERT INTO traslado(
                idTraslado,
                idTipoTraslado,
                idMotivoTraslado,
                idAlmacenOrigen,
                idAlmacenDestino,
                idSucursalDestino,
                idSucursal,
                observacion,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
                idTraslado,
                idTipoTraslado,
                idMotivoTraslado,
                idAlmacenOrigen,
                idAlmacenDestino,
                idSucursalDestino,
                idSucursal,
                observacion,
                date,
                time,
                idUsuario
            ]);

            // Obtiene el último código numérico para trasladoDetalle
            const resultTrasladoDetalle = await conec.execute(connection, 'SELECT idTrasladoDetalle FROM trasladoDetalle');
            let idTrasladoDetalle = generateNumericCode(1, resultTrasladoDetalle, 'idTrasladoDetalle');

            // Obtiene el último código numérico para kardex
            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Itera sobre los detalles de traslado proporcionados en la solicitud
            for (const detalle of detalles) {
                const cantidad = detalle.lotes
                    ? detalle.lotes.reduce((acc, lote) => acc + Number(lote.cantidadAjustar), 0)
                    : Number(detalle.cantidad);

                // Inserta un nuevo registro en la tabla trasladoDetalle
                await conec.execute(connection, `
                INSERT INTO trasladoDetalle(
                    idTrasladoDetalle,
                    idTraslado,
                    idProducto,
                    cantidad
                ) VALUES(?,?,?,?)`, [
                    idTrasladoDetalle,
                    idTraslado,
                    detalle.idProducto,
                    cantidad
                ]);

                // Incrementa el código numérico
                idTrasladoDetalle++;

                // Obtiene el inventario del producto en el almacén de origen
                const inventarioOrigen = await conec.execute(connection, `
                SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    detalle.idProducto,
                    idAlmacenOrigen,
                ]);

                // Obtiene el inventario del producto en el almacén de destino
                const inventarioDestino = await conec.execute(connection, `
                SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    detalle.idProducto,
                    idAlmacenDestino,
                ]);

                // Actualiza el inventario en el almacén de origen
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad - ?
                WHERE 
                    idInventario = ?`, [
                    cantidad,
                    inventarioOrigen[0].idInventario
                ]);

                // Actualiza el inventario en el almacén de destino
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    cantidad,
                    inventarioDestino[0].idInventario
                ]);

                // Obtiene el costo del producto
                const producto = await conec.execute(connection, `
                SELECT 
                    costo 
                FROM 
                    producto 
                WHERE 
                    idProducto = ?`, [
                    detalle.idProducto,
                ]);

                if (detalle.lotes) {
                    for (const lote of detalle.lotes) {
                        // Actualiza el lote de origen
                        await conec.execute(connection, `
                        UPDATE 
                            lote 
                        SET 
                            cantidad = cantidad - ? 
                        WHERE 
                            idLote = ?`, [
                            Number(lote.cantidadAjustar),
                            lote.idLote
                        ]);

                        // Inserta información en el Kardex con ID del lote de origen
                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idTraslado,
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
                            `KD${String(idKardex += 1).padStart(4, '0')}`,
                            detalle.idProducto,
                            'TK0002',
                            'MK0002',
                            idTraslado,
                            `SALIDA POR TRASLADO (LOTE: ${lote.codigoLote})`,
                            Number(lote.cantidadAjustar),
                            producto[0].costo,
                            idAlmacenOrigen,
                            inventarioOrigen[0].idInventario,
                            lote.idLote,
                            date,
                            time,
                            idUsuario
                        ]);

                        // Inserta un nuevo registroo o actualizar en el inventario de destino
                        const loteExist = await conec.execute(connection, `
                            SELECT 
                                idLote 
                            FROM 
                                lote 
                            WHERE 
                                idInventario = ? AND codigoLote = ?`, [
                            inventarioDestino[0].idInventario,
                            lote.codigoLote,
                        ]);

                        let idLote = null;

                        if (loteExist.length === 0) {
                            const [day, month, year] = lote.fechaVencimiento.split('/');
                            const fecha = new Date(`${year}-${month}-${day}`);

                            await conec.execute(connection, `
                                INSERT INTO lote (
                                    idInventario,
                                    codigoLote,
                                    fechaVencimiento,
                                    cantidad
                                ) VALUES(?,?,?,?)`, [
                                inventarioDestino[0].idInventario,
                                lote.codigoLote,
                                fecha,
                                Number(lote.cantidadAjustar),
                            ]);

                            // Obtener el ID insertado del lote de destino
                            const [lastLote] = await conec.execute(connection, 'SELECT LAST_INSERT_ID() AS id');

                            idLote = lastLote.id;

                        } else {
                            await conec.execute(connection, `
                                UPDATE 
                                    lote 
                                SET 
                                    cantidad = cantidad + ?
                                WHERE 
                                    idLote = ?`, [
                                Number(lote.cantidadAjustar),
                                loteExist[0].idLote
                            ]);

                            idLote = loteExist[0].idLote;
                        }

                        // Inserta información en el Kardex con ID del lote de destino
                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idCompra,
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
                            `KD${String(idKardex += 1).padStart(4, '0')}`,
                            detalle.idProducto,
                            'TK0001',
                            'MK0002',
                            idTraslado,
                            `INGRESO POR TRASLADO (LOTE: ${lote.codigoLote})`,
                            Number(lote.cantidadAjustar),
                            producto[0].costo,
                            idAlmacenDestino,
                            inventarioDestino[0].idInventario,
                            idLote,
                            date,
                            time,
                            idUsuario
                        ]);
                    }
                } else {
                    // Inserta registros en la tabla kardex para la salida del almacén de origen
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idTraslado,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        detalle.idProducto,
                        'TK0002',
                        'MK0002',
                        idTraslado,
                        'SALIDA POR TRASLADO',
                        cantidad,
                        producto[0].costo,
                        idAlmacenOrigen,
                        inventarioOrigen[0].idInventario,
                        date,
                        time,
                        idUsuario
                    ]);

                    // Inserta registros en la tabla kardex para la entrada en el almacén de destino
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idTraslado,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        detalle.idProducto,
                        'TK0001',
                        'MK0002',
                        idTraslado,
                        'INGRESO POR TRASLADO',
                        cantidad,
                        producto[0].costo,
                        idAlmacenDestino,
                        inventarioDestino[0].idInventario,
                        date,
                        time,
                        idUsuario
                    ]);
                }
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "create";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            console.log(error);

            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            // Inicia una transacción de la base de datos
            connection = await conec.beginTransaction();

            // Obtiene información del traslado con el ID proporcionado
            const traslado = await conec.execute(connection, `
            SELECT 
                idTraslado,
                idAlmacenOrigen,
                idAlmacenDestino,
                estado 
            FROM 
                traslado 
            WHERE 
                idTraslado = ?`, [
                req.query.idTraslado,
            ])

            // Verifica si el traslado existe
            if (traslado.length === 0) {
                await conec.rollback(connection);
                return "El traslado no existe, verifique el código o actualiza la lista."
            }

            // Verifica si el traslado ya se encuentra cancelado
            if (traslado[0].estado === 0) {
                await conec.rollback(connection);
                return "El traslado ya se encuentra con estado cancelado."
            }

            // Actualiza el estado del traslado a cancelado
            await conec.execute(connection, `
            UPDATE 
                traslado 
            SET 
                estado = 0 
            WHERE 
                idTraslado = ?`, [
                req.query.idTraslado,
            ])

            // Obtiene los detalles del traslado
            const trasladoDetalle = await conec.execute(connection, `
            SELECT 
                idProducto,
                cantidad 
            FROM 
                trasladoDetalle 
            WHERE 
                idTraslado = ?`, [
                req.query.idTraslado,
            ])

            // Obtiene el último código numérico para kardex
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

            // Itera sobre los detalles del traslado para realizar las operaciones necesarias
            for (const item of trasladoDetalle) {
                const kardexes = await conec.execute(connection, `
                SELECT 
                    k.idProducto,
                    k.idTipoKardex,
                    k.cantidad,
                    k.costo,
                    k.idAlmacen,
                    k.idInventario    
                FROM 
                    kardex AS k 
                WHERE 
                    k.idTraslado = ? AND k.idProducto = ?`, [
                    req.query.idTraslado,
                    item.idProducto,
                ]);

                for (const kardex of kardexes) {
                    if (kardex.idTipoKardex === "TK0001") {

                        // Actualiza el inventario en el almacén de destino (reversa de operaciones)
                        await conec.execute(connection, `
                        UPDATE 
                            inventario 
                        SET 
                            cantidad = cantidad - ?
                        WHERE 
                            idInventario = ?`, [
                            kardex.cantidad,
                            kardex.idInventario
                        ]);

                        // Inserta registros en la tabla kardex para la anulación del ingreso en el almacén de destino
                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idTraslado,
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
                            req.query.idTraslado,
                            'ANULAR INGRESO POR TRASLADO',
                            kardex.cantidad,
                            kardex.costo,
                            kardex.idAlmacen,
                            kardex.idInventario,
                            currentTime(),
                            currentDate(),
                            req.query.idUsuario
                        ]);
                    } else {
                        // Actualiza el inventario en el almacén de origen (reversa de operaciones)
                        await conec.execute(connection, `
                        UPDATE 
                            inventario 
                        SET 
                            cantidad = cantidad + ?
                        WHERE 
                            idInventario = ?`, [
                            kardex.cantidad,
                            kardex.idInventario
                        ]);

                        // Inserta registros en la tabla kardex para la anulación de la salida del almacén de origen
                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idTraslado,
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
                            req.query.idTraslado,
                            'ANULAR SALIDA POR TRASLADO',
                            kardex.cantidad,
                            kardex.costo,
                            kardex.idAlmacen,
                            kardex.idInventario,
                            currentTime(),
                            currentDate(),
                            req.query.idUsuario
                        ]);
                    }
                }
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "cancel";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Traslado;