const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');
const { KARDEX_TYPES, KARDEX_MOTIVOS } = require('../config/constants');

class TrasladoService {

    async list(data) {
        const { opcion, buscar, idSucursal, idTipoTraslado, fechaInicio, fechaFinal, posicionPagina, filasPorPagina } = data;
        const lista = await conec.procedure(`CALL Listar_Traslado(?,?,?,?,?,?,?,?)`, [
            parseInt(opcion),
            buscar,
            idSucursal,
            idTipoTraslado,
            fechaInicio,
            fechaFinal,
            parseInt(posicionPagina),
            parseInt(filasPorPagina)
        ])

        const resultLista = lista.map(function (item, index) {
            return {
                ...item,
                id: (index + 1) + parseInt(posicionPagina)
            }
        });

        const total = await conec.procedure(`CALL Listar_Traslado_Count(?,?,?,?,?,?)`, [
            parseInt(opcion),
            buscar,
            idSucursal,
            idTipoTraslado,
            fechaInicio,
            fechaFinal,
        ]);

        return { "result": resultLista, "total": total[0].Total };
    }

    async detail(idTraslado) {
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
                pu.informacion AS usuarioNombre
            FROM 
                traslado AS a
            INNER JOIN 
                tipoTraslado AS tt ON tt.idTipoTraslado = a.idTipoTraslado
            INNER JOIN 
                motivoTraslado AS mt ON mt.idMotivoTraslado = a.idMotivoTraslado
            INNER JOIN 
                usuario AS u ON u.idUsuario = a.idUsuario
            INNER JOIN
                persona AS pu ON pu.idPersona = u.idPersona
            INNER JOIN 
                almacen AS alo ON alo.idAlmacen = a.idAlmacenOrigen
            INNER JOIN 
                almacen AS ald ON ald.idAlmacen = a.idAlmacenDestino
            LEFT JOIN 
                sucursal AS sd ON sd.idSucursal = a.idSucursalDestino
            WHERE 
                a.idTraslado = ?`, [
            idTraslado,
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
            idTraslado,
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
    }

    async create(body) {
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
            } = body;

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
            const kardexIds = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Itera sobre los detalles de traslado proporcionados en la solicitud
            for (const detalle of detalles) {
                const cantidad = detalle.inventarioDetalles.reduce((acum, item) => acum + Number(item.cantidadTrasladar), 0);

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

                // Obtiene el costo del producto
                const [{ costo }] = await conec.execute(connection, `
                SELECT 
                    costo 
                FROM 
                    producto 
                WHERE 
                    idProducto = ?`, [
                    detalle.idProducto,
                ]);

                for (const inventarioDetalle of detalle.inventarioDetalles) {
                    const cantidadTrasladar = Number(inventarioDetalle.cantidadTrasladar);

                    if (idAlmacenOrigen) {
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
                            lote,
                            idUbicacion,
                            fechaVencimiento,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            detalle.idProducto,
                            KARDEX_TYPES.SALIDA,
                            KARDEX_MOTIVOS.SALIDA,
                            idTraslado,
                            'SALIDA POR TRASLADO',
                            cantidadTrasladar,
                            costo,
                            idAlmacenOrigen,
                            inventarioDetalle.lote,
                            inventarioDetalle.idUbicacion,
                            inventarioDetalle.fechaVencimiento,
                            date,
                            time,
                            idUsuario
                        ]);
                    }

                    if (idAlmacenDestino) {
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
                            lote,
                            idUbicacion,
                            fechaVencimiento,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            detalle.idProducto,
                            KARDEX_TYPES.INGRESO,
                            KARDEX_MOTIVOS.ENTREDA,
                            idTraslado,
                            'INGRESO POR TRASLADO',
                            cantidadTrasladar,
                            costo,
                            idAlmacenDestino,
                            inventarioDetalle.lote,
                            inventarioDetalle.idUbicacion,
                            inventarioDetalle.fechaVencimiento,
                            date,
                            time,
                            idUsuario
                        ]);
                    }
                }
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "Se registró correctamente el traslado.";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async cancel(data) {
        let connection = null;
        try {
            const { idTraslado, idUsuario } = data;

            // Inicia una transacción de la base de datos
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            // Obtiene información del traslado con el ID proporcionado
            const [traslado] = await conec.execute(connection, `
            SELECT 
                idTraslado,
                idAlmacenOrigen,
                idAlmacenDestino,
                estado 
            FROM 
                traslado 
            WHERE 
                idTraslado = ?`, [
                idTraslado,
            ])

            // Verifica si el ajuste existe
            if (!traslado) {
                await conec.rollback(connection);
                return "El traslado no existe, verifique el código o actualiza la lista.";
            }

            // Verifica si el traslado ya se encuentra cancelado
            if (traslado.estado === 0) {
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
                idTraslado,
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
                idTraslado,
            ])

            // Obtiene el último código numérico para kardex
            const resultKardex = await conec.execute(connection, "SELECT idKardex FROM kardex");
            let idKardex = resultKardex.length ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Itera sobre los detalles del traslado para realizar las operaciones necesarias
            for (const item of trasladoDetalle) {
                const kardexes = await conec.execute(connection, `
                SELECT 
                    k.idInventario,
                    k.idTipoKardex,
                    k.cantidad,
                    k.costo,
                    k.idAlmacen,
                    k.lote,
                    k.idUbicacion,
                    k.fechaVencimiento
                FROM 
                    kardex AS k 
                INNER JOIN
                    inventario AS i ON k.idInventario = i.idInventario
                WHERE 
                    k.idTraslado = ? AND i.idProducto = ?`, [
                    idTraslado,
                    item.idProducto,
                ]);

                for (const kardex of kardexes) {
                    if (kardex.idTipoKardex === KARDEX_TYPES.INGRESO) {
                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex, 
                            idInventario, 
                            idTipoKardex, 
                            idMotivoKardex, 
                            idTraslado,
                            detalle, 
                            cantidad, 
                            costo, 
                            lote,
                            idUbicacion,
                            fechaVencimiento,
                            fecha, 
                            hora, 
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            item.idInventario,
                            KARDEX_TYPES.SALIDA,
                            KARDEX_MOTIVOS.AJUSTE,
                            idTraslado,
                            'ANULAR INGRESO POR TRASLADO',
                            kardex.cantidad,
                            kardex.costo,
                            kardex.idAlmacen,
                            kardex.lote,
                            kardex.idUbicacion,
                            kardex.fechaVencimiento,
                            date,
                            time,
                            idUsuario
                        ]);
                    } else {
                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex, 
                            idInventario, 
                            idTipoKardex, 
                            idMotivoKardex, 
                            idTraslado,
                            detalle, 
                            cantidad, 
                            costo, 
                            lote,
                            idUbicacion,
                            fechaVencimiento,
                            fecha, 
                            hora, 
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            item.idInventario,
                            KARDEX_TYPES.INGRESO,
                            KARDEX_MOTIVOS.AJUSTE,
                            idTraslado,
                            'ANULAR SALIDA POR TRASLADO',
                            kardex.cantidad,
                            kardex.costo,
                            kardex.lote,
                            kardex.idUbicacion,
                            kardex.fechaVencimiento,
                            date,
                            time,
                            idUsuario
                        ]);
                    }
                }
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "Se anuló el traslado correctamente.";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

}

module.exports = new TrasladoService();
