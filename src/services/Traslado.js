const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

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
            const traslado = await conec.query(`SELECT 
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
            FROM traslado AS a
                INNER JOIN tipoTraslado AS tt ON tt.idTipoTraslado = a.idTipoTraslado
                INNER JOIN motivoTraslado AS mt ON mt.idMotivoTraslado = a.idMotivoTraslado
                INNER JOIN usuario AS u ON u.idUsuario = a.idUsuario
                INNER JOIN almacen AS alo ON alo.idAlmacen = a.idAlmacenOrigen
                INNER JOIN almacen AS ald ON ald.idAlmacen = a.idAlmacenDestino
                LEFT JOIN sucursal AS sd ON sd.idSucursal = a.idSucursalDestino
            WHERE a.idTraslado = ?`, [
                req.query.idTraslado,
            ])

            const detalle = await conec.query(`SELECT 
                p.codigo,
                p.nombre as producto,
                aj.cantidad,
                m.nombre as unidad,
                c.nombre as categoria
            FROM 
                trasladoDetalle as aj
                INNER JOIN producto as p on p.idProducto = aj.idProducto
                INNER JOIN medida as m on m.idMedida = p.idMedida
                INNER JOIN categoria as c on c.idCategoria = p.idCategoria
            WHERE aj.idTraslado = ?`, [
                req.query.idTraslado,
            ])

            return { cabecera: traslado[0], detalle };
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
                estado,
                idUsuario,
            } = req.body;

            // Genera un nuevo código alfanumérico para el traslado
            const result = await conec.execute(connection, 'SELECT idTraslado FROM traslado');
            const idTraslado = generateAlphanumericCode("TL0001", result, 'idTraslado');
           
            // Inserta un nuevo registro en la tabla traslado
            await conec.execute(connection, `INSERT INTO traslado(
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
                estado,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idTraslado,
                idTipoTraslado,
                idMotivoTraslado,
                idAlmacenOrigen,
                idAlmacenDestino,
                idSucursalDestino,
                idSucursal,
                observacion,
                currentDate(),
                currentTime(),
                estado,
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
            for (const item of req.body.detalle) {
                // Inserta un nuevo registro en la tabla trasladoDetalle
                await conec.execute(connection, `INSERT INTO trasladoDetalle(
                    idTrasladoDetalle,
                    idTraslado,
                    idProducto,
                    cantidad
                ) VALUES(?,?,?,?)`, [
                    idTrasladoDetalle,
                    idTraslado,
                    item.idProducto,
                    parseFloat(item.cantidad)
                ]);

                // Incrementa el código numérico
                idTrasladoDetalle++;

                // Obtiene el inventario del producto en el almacén de origen
                const inventarioOrigen = await conec.execute(connection, `SELECT 
                        idInventario 
                    FROM 
                        inventario 
                    WHERE 
                        idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacenOrigen,
                ]);

                // Obtiene el inventario del producto en el almacén de destino
                const inventarioDestino = await conec.execute(connection, `SELECT 
                        idInventario 
                    FROM 
                        inventario 
                    WHERE 
                        idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacenDestino,
                ]);

                // Actualiza el inventario en el almacén de origen
                await conec.execute(connection, `UPDATE inventario 
                    SET 
                        cantidad = cantidad - ?
                    WHERE 
                        idInventario = ?`, [
                    item.cantidad,
                    inventarioOrigen[0].idInventario
                ]);

                // Actualiza el inventario en el almacén de destino
                await conec.execute(connection, `UPDATE inventario 
                    SET 
                        cantidad = cantidad + ?
                    WHERE 
                        idInventario = ?`, [
                    item.cantidad,
                    inventarioDestino[0].idInventario
                ]);

                // Obtiene el costo del producto
                const producto = await conec.execute(connection, `SELECT 
                        costo 
                    FROM 
                        producto 
                    WHERE 
                        idProducto = ?`, [
                    item.idProducto,
                ]);

                // Inserta registros en la tabla kardex para la salida del almacén de origen
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
                    'SALIDA POR TRASLADO',
                    item.cantidad,
                    producto[0].costo,
                    idAlmacenOrigen,
                    currentTime(),
                    currentDate(),
                    idUsuario
                ]);

                // Inserta registros en la tabla kardex para la entrada en el almacén de destino
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
                    'INGRESO POR TRASLADO',
                    item.cantidad,
                    producto[0].costo,
                    idAlmacenDestino,
                    currentTime(),
                    currentDate(),
                    idUsuario
                ]);
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "create";
        } catch (error) {           
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            // Inicia una transacción de la base de datos
            connection = await conec.beginTransaction();

            // Obtiene información del traslado con el ID proporcionado
            const traslado = await conec.execute(connection, `SELECT 
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
            await conec.execute(connection, `UPDATE traslado 
            SET 
                estado = 0 
            WHERE 
                idTraslado = ?`, [
                req.query.idTraslado,
            ])

            // Obtiene los detalles del traslado
            const trasladoDetalle = await conec.execute(connection, `SELECT 
                idProducto,
                cantidad 
            FROM 
                trasladoDetalle 
            WHERE 
                idTraslado = ?`, [
                req.query.idTraslado,
            ])

            // Obtiene el último código numérico para kardex
            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Itera sobre los detalles del traslado para realizar las operaciones necesarias
            for (const item of trasladoDetalle) {
                // Obtiene el inventario del producto en el almacén de origen
                const inventarioOrigen = await conec.execute(connection, `SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    traslado[0].idAlmacenOrigen,
                ]);

                // Obtiene el inventario del producto en el almacén de destino
                const inventarioDestino = await conec.execute(connection, `SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    traslado[0].idAlmacenDestino,
                ]);

                // Actualiza el inventario en el almacén de origen (reversa de operaciones)
                await conec.execute(connection, `UPDATE inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    item.cantidad,
                    inventarioOrigen[0].idInventario
                ]);

                // Actualiza el inventario en el almacén de destino (reversa de operaciones)
                await conec.execute(connection, `UPDATE inventario 
                SET 
                    cantidad = cantidad - ?
                WHERE 
                    idInventario = ?`, [
                    item.cantidad,
                    inventarioDestino[0].idInventario
                ]);

                // Obtiene el costo del producto
                const producto = await conec.execute(connection, `SELECT 
                    costo 
                FROM 
                    producto 
                WHERE 
                    idProducto = ?`, [
                    item.idProducto,
                ]);

                // Inserta registros en la tabla kardex para la anulación de la salida del almacén de origen
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
                    'ANULAR SALIDA POR TRASLADO',
                    item.cantidad,
                    producto[0].costo,
                    traslado[0].idAlmacenOrigen,
                    currentTime(),
                    currentDate(),
                    req.query.idUsuario
                ]);

                // Inserta registros en la tabla kardex para la anulación del ingreso en el almacén de destino
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
                    'ANULAR INGRESO POR TRASLADO',
                    item.cantidad,
                    producto[0].costo,
                    traslado[0].idAlmacenDestino,
                    currentTime(),
                    currentDate(),
                    req.query.idUsuario
                ]);
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