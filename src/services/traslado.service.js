const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, renderTemplate } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');
const { ClientError } = require('../tools/Error');
const { default: axios } = require('axios');
const { cssUrl, logoUrl } = require('../common/constants/paths.constants');

class Traslado {

    async list(req) {
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
    }

    async detail(req) {
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
            return {
                ...item,
                imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                id: index + 1,
            }
        });

        return { cabecera: traslado[0], detalles: listaDetalles };
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
                const cantidad = Number(detalle.cantidad);

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
                throw new ClientError("El traslado no existe, verifique el código o actualiza la lista.");
            }

            // Verifica si el traslado ya se encuentra cancelado
            if (traslado[0].estado === 0) {
                throw new ClientError("El traslado ya se encuentra con estado cancelado.");
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
            return "Se anuló el traslado correctamente.";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async pdf(req) {
        const { idTraslado, size } = req.params;

        const empresa = await conec.query(`
        SELECT
            documento,
            razonSocial,
            nombreEmpresa,
            rutaLogo
        FROM 
            empresa`);

        if (empresa.length === 0) {
            throw new ClientError("No se pudo obtener datos de empresa, vuelve a recargar la vista.");
        }

        const sucursal = await conec.query(`
        SELECT 
            s.nombre,
            s.telefono,
            s.celular,
            s.email,
            s.paginaWeb,
            s.direccion,

            ub.departamento,
            ub.provincia,
            ub.distrito
        FROM 
            sucursal AS s
        INNER JOIN
            ubigeo AS ub ON ub.idUbigeo = s.idUbigeo
        WHERE 
            s.principal = 1`);

        if (sucursal.length === 0) {
            throw new ClientError("No se pudo obtener datos del sucursal, vuelve a recargar la vista.")
        }

        const traslado = await conec.query(`
        SELECT 
            a.idTraslado,
            DATE_FORMAT(a.fecha, '%d/%m/%Y') AS fecha,
            a.hora,
            a.observacion,
            tt.nombre AS tipo,
            mt.nombre AS motivo,

            so.nombre AS sucursalOrigen,
            alo.nombre AS almacenOrigen,

            IFNULL(sd.nombre, '') AS sucursalDestino,
            ald.nombre AS almacenDestino,
            a.observacion
        FROM 
            traslado AS a
        INNER JOIN 
            tipoTraslado AS tt ON tt.idTipoTraslado = a.idTipoTraslado
        INNER JOIN 
            motivoTraslado AS mt ON mt.idMotivoTraslado = a.idMotivoTraslado
        INNER JOIN
            sucursal AS so ON so.idSucursal = a.idSucursal
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

        if (traslado.length === 0) {
            throw new ClientError("No se pudo obtener datos del traslado, vuelve a recarga la vista.")
        }

        const detalles = await conec.query(`
        SELECT 
            ROW_NUMBER() OVER (ORDER BY td.idTrasladoDetalle ASC) AS id,
            p.codigo,
            p.nombre,
            p.imagen,
            td.cantidad,
            m.nombre as medidda,
            c.nombre as categoria
        FROM 
            trasladoDetalle as td
        INNER JOIN 
            producto as p on p.idProducto = td.idProducto
        INNER JOIN 
            medida as m on m.idMedida = p.idMedida
        INNER JOIN 
            categoria as c on c.idCategoria = p.idCategoria
        WHERE 
            td.idTraslado = ?`, [
            idTraslado,
        ]);

        if (detalles.length === 0) {
            throw new ClientError("No se pudo obtener datos del detalle de traslado, vuelve a recarga la vista.")
        }

        const title = 'Traslado';

        const template = size === 'A4' ? 'traslado/a4' : 'traslado/ticket';

        const html = await renderTemplate(template, {
            style: cssUrl,
            icon: logoUrl,
            title: title,
            empresa: {
                ...empresa[0],
                rutaLogo: empresa[0].rutaLogo && bucket ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
            },
            sucursal: {
                ...sucursal[0],
                ubigeo: {
                    departamento: sucursal[0].departamento,
                    provincia: sucursal[0].provincia,
                    distrito: sucursal[0].distrito
                }
            },
            traslado: traslado[0],
            detalles: detalles,

        });

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/html-to-pdf`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: {
                title: title,
                htmlContent: html,
                paper: {
                    paperType: size,
                    width: 0,
                    height: 0,
                },
                outputType: 'pdf'
            },
            timeout: 60000,
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return response;
    }

}

module.exports = new Traslado();