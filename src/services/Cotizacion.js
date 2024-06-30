const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendSave } = require('../tools/Message');
require('dotenv').config();
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Compra {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cotizaciones(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                parseInt(req.query.estado),

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Cotizaciones_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                parseInt(req.query.estado),
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/list", error)
        }
    }

    async id(req, res) {
        try {
            const cabecera = await conec.query(`
            SELECT 
                p.idPersona,
                p.documento,
                p.informacion,
                p.celular,
                p.email,
                p.direccion,
                c.idComprobante,
                c.idMoneda,
                c.observacion,
                c.nota
            FROM 
                cotizacion AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idCliente
            WHERE 
                c.idCotizacion = ?`, [
                req.query.idCotizacion,
            ]);

            const detalle = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCotizacionDetalle ASC) AS id,
                cd.cantidad,
                cd.idImpuesto,
                p.idMedida,
                p.idProducto,
                p.nombre,
                i.nombre AS nombreImpuesto,
                m.nombre AS nombreMedida,
                i.porcentaje AS porcentajeImpuesto,
                cd.precio,
                tp.nombre as tipoProducto,
                p.idTipoTratamientoProducto
            from 
                cotizacionDetalle AS cd
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN 
                impuesto AS i ON cd.idImpuesto = i.idImpuesto
            WHERE 
                cd.idCotizacion = ?
            ORDER BY 
                cd.idCotizacionDetalle ASC`, [
                req.query.idCotizacion,
            ]);

            const idImpuesto = detalle[0]?.idImpuesto ?? '';
            cabecera[0].idImpuesto = idImpuesto;

            return sendSuccess(res, { cabecera: cabecera[0], detalle });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/id", error)
        }
    }

    async detail(req, res) {
        try {
            // Consulta la información principal de la compra
            const cotizacion = await conec.query(`
            SELECT 
                DATE_FORMAT(c.fecha, '%d/%m/%Y') AS fecha, 
                c.hora,
                co.nombre AS comprobante,
                c.serie,
                c.numeracion,
                cn.documento,
                cn.informacion,
                cn.telefono,
                cn.celular,
                cn.email,
                cn.direccion,                
                c.estado,
                c.observacion,
                c.nota,
                mo.codiso,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                cotizacion AS c
            INNER JOIN 
                comprobante AS co ON co.idComprobante = c.idComprobante
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = c.idMoneda
            INNER JOIN 
                persona AS cn ON cn.idPersona = c.idCliente
            INNER JOIN 
                usuario AS us ON us.idUsuario = c.idUsuario 
            WHERE 
                c.idCotizacion = ?`, [
                req.query.idCotizacion,
            ]);

            // Consulta los detalles de la compra
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCotizacionDetalle ASC) AS id,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                cd.precio,
                cd.cantidad,
                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                cotizacionDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = cd.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto 
            WHERE
                cd.idCotizacion = ?
            ORDER BY 
                cd.idCotizacionDetalle ASC`, [
                req.query.idCotizacion,
            ]);

            // Consulta los ventas asociadas
            const ventas = await conec.query(`
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY v.idVenta DESC) AS id,
                    v.idVenta,
                    DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha,
                    v.hora,
                    co.nombre AS comprobante,
                    v.serie,
                    v.numeracion,
                    v.estado
                FROM 
                    ventaCotizacion AS vc 
                INNER JOIN 
                    cotizacion AS c ON c.idCotizacion = vc.idCotizacion
                INNER JOIN 
                    venta AS v ON v.idVenta = vc.idVenta
                INNER JOIN 
                    comprobante AS co ON co.idComprobante = v.idComprobante
                WHERE 
                    vc.idCotizacion = ?
                ORDER BY 
                    v.fecha DESC, v.hora DESC`, [
                req.query.idCotizacion,
            ]);

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cabecera: cotizacion[0], detalles, ventas });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/detail", error)
        }
    }

    async detailVenta(req, res) {
        try {
            const cliente = await conec.query(`
            SELECT                 
                p.idPersona,
                p.idTipoCliente,     
                p.idTipoDocumento,
                p.documento,
                p.informacion,
                IFNULL(p.celular,'') AS celular,
                IFNULL(p.email,'') AS email,
                IFNULL(p.direccion,'') AS direccion
            FROM 
                cotizacion AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idCliente
            WHERE 
                c.idCotizacion = ?`, [
                req.query.idCotizacion
            ]);

            const detalles = await conec.query(`
            SELECT 
                cd.idProducto,
                cd.precio,
                cd.cantidad
            FROM
                cotizacionDetalle AS cd
            WHERE
                cd.idCotizacion = ?
            ORDER BY 
                cd.idCotizacionDetalle ASC`, [
                req.query.idCotizacion
            ]);

            let productos = [];

            for (const item of detalles) {
                const producto = await conec.query(`
                SELECT 
                    p.idProducto, 
                    p.codigo,
                    p.nombre AS nombreProducto, 
                    p.preferido,
                    p.negativo,
                    c.nombre AS categoria, 
                    m.nombre AS medida,
                    p.idTipoTratamientoProducto,
                    p.imagen,
                    a.nombre AS almacen,
                    i.idInventario,
                    'PRODUCTO' AS tipo
                FROM 
                    producto AS p
                    INNER JOIN precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                    INNER JOIN categoria AS c ON p.idCategoria = c.idCategoria
                    INNER JOIN medida AS m ON m.idMedida = p.idMedida
                    INNER JOIN inventario AS i ON i.idProducto = p.idProducto 
                    INNER JOIN almacen AS a ON a.idAlmacen = i.idAlmacen
                WHERE 
                    p.idProducto = ? AND a.idAlmacen = ?
                UNION
                SELECT 
                    p.idProducto, 
                    p.codigo,
                    p.nombre AS nombreProducto, 
                    p.preferido,
                    p.negativo,
                    c.nombre AS categoria, 
                    m.nombre AS medida,
                    p.idTipoTratamientoProducto,
                    p.imagen,
                    'SIN ALMACEN' AS almacen,
                    0 AS idInventario,
                    'SERVICIO' AS tipo
                FROM 
                    producto AS p
                INNER JOIN precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                INNER JOIN categoria AS c ON p.idCategoria = c.idCategoria
                INNER JOIN medida AS m ON m.idMedida = p.idMedida
                WHERE 
                    p.idProducto = ?`, [
                    item.idProducto,
                    req.query.idAlmacen,
                    item.idProducto
                ]);

                const newProducto = {
                    ...producto[0],
                    precio: item.precio,
                    cantidad: item.cantidad
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cliente: cliente[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/detailVenta", error)
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            // Genera un nuevo ID para la cotización
            const result = await conec.execute(connection, 'SELECT idCotizacion FROM cotizacion');
            const idCotizacion = generateAlphanumericCode("CT0001", result, 'idCotizacion');

            // Consulta datos del comprobante para generar la numeración
            const comprobante = await conec.execute(connection, `
            SELECT 
                serie,
                numeracion 
            FROM 
                comprobante 
            WHERE 
                idComprobante  = ?`, [
                req.body.idComprobante
            ]);

            // Consulta numeraciones de cotización asociadas al mismo comprobante
            const cotizaciones = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                cotizacion 
            WHERE 
                idComprobante = ?`, [
                req.body.idComprobante
            ]);

            // Genera una nueva numeración para la compra
            const numeracion = generateNumericCode(comprobante[0].numeracion, cotizaciones, "numeracion");

            await conec.execute(connection, `INSERT INTO cotizacion(
                idCotizacion,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,
                observacion,
                nota,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idCotizacion,
                req.body.idCliente,
                req.body.idUsuario,
                req.body.idComprobante,
                req.body.idSucursal,
                req.body.idMoneda,
                comprobante[0].serie,
                numeracion,
                req.body.observacion,
                req.body.nota,
                req.body.estado,
                currentDate(),
                currentTime(),
            ]);

            // Genera un nuevo ID para los detalles de cotización
            const listaCotizacionDetalle = await conec.execute(connection, 'SELECT idCotizacionDetalle FROM cotizacionDetalle');
            let idCotizacionDetalle = generateNumericCode(1, listaCotizacionDetalle, 'idCotizacionDetalle');

            // Inserta los detalles de compra en la base de datos
            for (const item of req.body.detalle) {
                await await conec.execute(connection, `INSERT INTO cotizacionDetalle(
                    idCotizacionDetalle,
                    idCotizacion,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idCotizacionDetalle,
                    idCotizacion,
                    item.idProducto,
                    item.idMedida,
                    item.precio,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idCotizacionDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idCotizacion: idCotizacion,
                message: "Se registró correctamente la cotización."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/create", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                cotizacion 
            SET
                idCliente = ?,
                idUsuario = ?,
                idSucursal = ?,
                idMoneda = ?,
                observacion = ?,
                nota = ?,
                estado = ?,
                fecha = ?,
                hora = ?
            WHERE 
                idCotizacion = ?`, [
                req.body.idCliente,
                req.body.idUsuario,
                req.body.idSucursal,
                req.body.idMoneda,
                req.body.observacion,
                req.body.nota,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idCotizacion,
            ]);

            await conec.execute(connection, `
            DELETE FROM 
                cotizacionDetalle
            WHERE 
                idCotizacion = ?`, [
                req.body.idCotizacion,
            ]);

            const listaCotizacionDetalle = await conec.execute(connection, 'SELECT idCotizacionDetalle FROM cotizacionDetalle');
            let idCotizacionDetalle = generateNumericCode(1, listaCotizacionDetalle, 'idCotizacionDetalle');

            // Inserta los detalles de compra en la base de datos
            for (const item of req.body.detalle) {
                await await conec.execute(connection, `
                INSERT INTO cotizacionDetalle(
                    idCotizacionDetalle,
                    idCotizacion,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idCotizacionDetalle,
                    req.body.idCotizacion,
                    item.idProducto,
                    item.idMedida,
                    item.precio,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idCotizacionDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idCotizacion: req.body.idCotizacion,
                message: "Se actualizó correctamente la cotización."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/update", error)
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const cotizacion = await conec.execute(connection, `
            SELECT
                estado
            FROM
                cotizacion
            WHERE
                idCotizacion = ?
            `, [
                req.query.idCotizacion
            ]);

            if (cotizacion.length === 0) {
                await conec.rollback(connection);
                return "No se encontro registros de la cotización.";
            }

            if (cotizacion[0].estado === 0) {
                await conec.rollback(connection);
                return "La cotización ya se encuentra anulado.";
            }

            await conec.execute(connection, `
            UPDATE 
                cotizacion
            SET 
                estado = 0
            WHERE
                idCotizacion = ?
            `, [
                req.query.idCotizacion
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente la cotización.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/cancel", error)
        }
    }
}

module.exports = Compra;