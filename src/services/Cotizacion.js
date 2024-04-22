const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendSave } = require('../tools/Message');
require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Compra {

    async list(req, res) {
        try {
            console.log(req.query)
            const lista = await conec.procedure(`CALL Listar_Cotizaciones(?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
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

            const total = await conec.procedure(`CALL Listar_Cotizaciones_Count(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

    async id(req, res) {
        try {
            const ajuste = await conec.query(`
            SELECT 
                a.idAjuste,
                DATE_FORMAT(a.fecha,'%d/%m/%Y') AS fecha,
                a.hora,
                tp.nombre AS tipo,
                mt.nombre AS motivo,
                al.nombre AS almacen,
                a.observacion,
                a.estado
            FROM 
                ajuste AS a 
            INNER JOIN 
                tipoAjuste AS tp ON tp.idTipoAjuste = a.idTipoAjuste
            INNER JOIN 
                motivoAjuste AS mt on mt.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN 
                almacen AS al on al.idAlmacen = a.idAlmacen
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
            return sendSuccess(res, { cabecera: ajuste[0], detalle });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
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
            const detalle = await conec.query(`
            SELECT 
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
                cd.idCotizacion = ?`, [
                req.query.idCotizacion,
            ]);

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cabecera: cotizacion[0], detalle });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

    async detailVenta(req, res) {
        try {
            const cliente = await conec.query(`
            SELECT 
                p.idPersona,
                p.documento,
                p.informacion
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
                cd.idCotizacion = ?`, [
                req.query.idCotizacion
            ]);

            let productos = [];

            for (const item of detalles) {
                console.log(item)
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
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
            ])

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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }
}

module.exports = Compra;