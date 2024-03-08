const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Compra {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cotizaciones(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Cotizaciones_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
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
            return { cabecera: cotizacion[0], detalle };
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
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

            await conec.execute(connection, `UPDATE cotizacion
            SET 
                estado = 0
            WHERE
                idCotizacion = ?
            `, [
                req.query.idCotizacion
            ]);

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