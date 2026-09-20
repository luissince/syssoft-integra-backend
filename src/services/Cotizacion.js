const {
    currentDate,
    currentTime,
    generateAlphanumericCode,
    generateNumericCode,
    toNullString,
    toNullNumber,
    calculateTaxBruto,
    calculateTax,
    formatNumberWithZeros,
    renderTemplate,
    rounded,
    formatDecimal,
} = require('../tools/Tools');
const { sendSuccess, sendError, sendSave, sendFile, sendClient } = require('../tools/Message');
const conec = require('../database/mysql-connection');
const { default: axios } = require('axios');
const firebaseService = require('../common/fire-base');
const { noImageUrl, cssUrl, logoUrl } = require('../common/constants/paths.constants');
const { ClientError } = require('../tools/Error');
const NumberLleters = require('../tools/NumberLleters');

class Cotizacion {

    async list(req, res) {
        try {
            const { opcion, buscar, fechaInicio, fechaFinal, idSucursal, ligado, estado, posicionPagina, filasPorPagina } = req.query;
            const lista = await conec.procedure(`CALL Listar_Cotizaciones(?,?,?,?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(buscar),
                toNullString(fechaInicio),
                toNullString(fechaFinal),
                idSucursal,
                toNullNumber(ligado),
                toNullNumber(estado),

                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ])

            const resultLista = await Promise.all(lista.map(async function (item, index) {
                const ligado = await conec.query(`
                SELECT
                    cd.idCotizacion,
                    SUM(cd.cantidad) AS cantidadCotizada,
                    COALESCE((
                        SELECT SUM(vd.cantidad)
                        FROM ventaCotizacion vc
                        INNER JOIN venta v 
                            ON v.idVenta = vc.idVenta
                            AND v.estado <> 3
                        INNER JOIN ventaDetalle vd 
                            ON vd.idVenta = v.idVenta
                        WHERE vc.idCotizacion = cd.idCotizacion
                    ), 0) AS cantidadVendida
                FROM cotizacionDetalle cd
                WHERE cd.idCotizacion = ?
                GROUP BY cd.idCotizacion`, [
                    item.idCotizacion
                ]);

                const cantidadCotizada = Number(ligado[0]?.cantidadCotizada ?? 0);
                const cantidadVendida = Number(ligado[0]?.cantidadVendida ?? 0);

                let estadoLigado = 0;

                if (cantidadVendida > 0 && cantidadVendida < cantidadCotizada) {
                    estadoLigado = 1;
                }

                if (cantidadVendida >= cantidadCotizada) {
                    estadoLigado = 2;
                }

                return {
                    ...item,
                    ligado: estadoLigado,
                    cantidadCotizada,
                    cantidadVendida,
                    id: (index + 1) + parseInt(posicionPagina)
                }
            }));

            const total = await conec.procedure(`CALL Listar_Cotizaciones_Count(?,?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(buscar),
                toNullString(fechaInicio),
                toNullString(fechaFinal),
                idSucursal,
                toNullNumber(ligado),
                toNullNumber(estado),
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

            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCotizacionDetalle ASC) AS id,
                cd.cantidad,
                cd.idImpuesto,
                p.idMedida,
                p.idProducto,
                p.codigo,
                p.nombre,
                p.imagen,
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

            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                }
            });

            const idImpuesto = detalles[0]?.idImpuesto ?? '';
            cabecera[0].idImpuesto = idImpuesto;

            return sendSuccess(res, { cabecera: cabecera[0], detalles: listaDetalles });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/id", error)
        }
    }

    async detail(req, res) {
        try {
            const { idCotizacion } = req.query;

            // Consulta la información principal de la compra
            const cotizacion = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY c.idCotizacion ASC) AS id,
                c.idCotizacion,
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
                idCotizacion
            ]);

            // Consulta los detalles de la compra
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCotizacionDetalle ASC) AS id,
                p.idProducto,
                p.codigo,
                p.nombre AS producto,
                p.imagen,

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
                idCotizacion
            ]);

            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                }
            });

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
                    v.estado,
                    m.codiso,
                    SUM(vd.precio * vd.cantidad) AS total
                FROM 
                    ventaCotizacion AS vc 
                INNER JOIN 
                    cotizacion AS c ON c.idCotizacion = vc.idCotizacion
                INNER JOIN 
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                INNER JOIN 
                    moneda AS m ON v.idMoneda = m.idMoneda
                INNER JOIN 
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN 
                    comprobante AS co ON co.idComprobante = v.idComprobante
                WHERE 
                    vc.idCotizacion = ? 
                GROUP BY 
                    v.idVenta, v.fecha, v.hora, co.nombre, v.serie, v.numeracion, v.estado,  m.codiso
                ORDER BY 
                    v.fecha DESC, v.hora DESC`, [
                idCotizacion
            ]);

            const vendidos = await conec.query(`
                SELECT 
                    p.idProducto,
                    SUM(vd.cantidad) AS cantidad
                FROM 
                    ventaCotizacion AS vc
                INNER JOIN
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                INNER JOIN
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN
                    producto AS p ON p.idProducto = vd.idProducto
                WHERE 
                    vc.idCotizacion = ?
                GROUP BY 
                    p.idProducto`, [
                idCotizacion
            ]);

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cabecera: cotizacion[0], detalles: listaDetalles, ventas, vendidos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/detail", error)
        }
    }

    async forSale(req, res) {
        try {
            const { idCotizacion } = req.query;

            const validate = await conec.query(`
                SELECT 
                    *
                FROM 
                    cotizacion
                WHERE 
                    idCotizacion = ? AND estado = 0`, [
                req.query.idCotizacion
            ]);

            if (validate.length !== 0) {
                throw new ClientError("La cotización se encuentra anulada.");
            }

            const cliente = await conec.query(`
            SELECT                 
                p.idPersona,
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
                idCotizacion
            ]);

            const vendidos = await conec.query(`
            SELECT 
                p.idProducto,
                SUM(vd.cantidad) AS cantidad
            FROM 
                ventaCotizacion AS vc
            INNER JOIN
                venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            INNER JOIN
                ventaDetalle AS vd ON vd.idVenta = v.idVenta
            INNER JOIN
                producto AS p ON p.idProducto = vd.idProducto
            WHERE 
                vc.idCotizacion = ?
            GROUP BY 
                p.idProducto`, [
                idCotizacion
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
                idCotizacion
            ]);

            const newDetalles = detalles
                .map((detalle) => {
                    const item = vendidos.find(pro => pro.idProducto === detalle.idProducto);
                    if (item) {
                        if (item.cantidad !== detalle.cantidad) {
                            return {
                                ...detalle,
                                cantidad: Math.abs(item.cantidad - detalle.cantidad),
                            };
                        }
                    } else {
                        return { ...detalle };
                    }
                    return null; // Se retorna `null` para que después se filtre
                })
                .filter(Boolean);

            let productos = [];

            let index = 0;
            for (const item of newDetalles) {
                const producto = await conec.procedure(`CALL Filtrar_Productos_Para_Venta(?,?,?,?,?)`, [
                    3,
                    item.idProducto,
                    req.query.idAlmacen,
                    0,
                    1
                ]);

                const newProducto = {
                    ...producto[0],
                    precio: item.precio ?? producto[0].precio,
                    cantidad: item.cantidad ?? producto[0].cantidad,
                    imagen: firebaseService.getUrl(producto[0].imagen),
                    id: index + 1
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cliente: cliente[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Cotizacion/forSale", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/forSale", error)
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
            for (const item of req.body.detalles) {
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

            const date = currentDate();
            const time = currentTime();

            const validate = await conec.execute(connection, `
                SELECT 
                    *
                FROM 
                    ventaCotizacion AS vc
                INNER JOIN
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                WHERE 
                    vc.idCotizacion = ?`, [
                req.body.idCotizacion
            ]);

            if (validate.length !== 0) {
                throw new ClientError("La cotización ya esta ligado a una venta y no se puede editar.");
            }

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
                date,
                time,
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
            for (const item of req.body.detalles) {
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
            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Cotizacion/update", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/update", error)
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `
                SELECT 
                    *
                FROM 
                    ventaCotizacion AS vc
                INNER JOIN
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                WHERE 
                    vc.idCotizacion = ?`, [
                req.query.idCotizacion
            ]);

            if (validate.length !== 0) {
                throw new ClientError("La cotización ya esta ligado a una venta y no se puede anular.");
            }

            const cotizacion = await conec.execute(connection, `
            SELECT
                estado
            FROM
                cotizacion
            WHERE
                idCotizacion = ?`, [
                req.query.idCotizacion
            ]);

            if (cotizacion.length === 0) {
                throw new ClientError("No se encontro registros de la cotización.");
            }

            if (cotizacion[0].estado === 0) {
                throw new ClientError("La cotización ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                cotizacion
            SET 
                estado = 0
            WHERE
                idCotizacion = ?`, [
                req.query.idCotizacion
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente la cotización.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Cotizacion/cancel", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/cancel", error)
        }
    }

    async pdfDocumentOrPreview(req, res) {
        try {
            const { idCotizacion, type, size } = req.params;

            const empresa = await conec.query(`
            SELECT
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                paginaWeb,
                tipoEnvio
            FROM 
                empresa`);

            if (empresa.length === 0) {
                throw new ClientError("No se pudo obtener datos de empresa, vuelve a recargar la vista.");
            }

            const cotizacion = await conec.query(`
            SELECT 
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,
                p.idSucursal,
                p.nota,

                c.nombre AS comprobante,
                p.serie,
                p.numeracion,

                cp.documento,
                cp.informacion,
                cp.direccion,

                m.nombre AS moneda,
                m.simbolo,
                m.codiso,

                u.apellidos,
                u.nombres
            FROM 
                cotizacion AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idCliente
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idCotizacion = ?`, [
                idCotizacion
            ]);

            if (cotizacion.length === 0) {
                throw new ClientError("No se pudo obtener datos de la cotización, vuelve a recargar la vista.");
            }

            const sucursal = await conec.query(`
            SELECT 
                s.nombre,
                s.telefono,
                s.celular,
                s.email,
                s.direccion,

                ub.departamento,
                ub.provincia,
                ub.distrito
            FROM 
                sucursal AS s
            INNER JOIN
                ubigeo AS ub ON ub.idUbigeo = s.idUbigeo
            WHERE 
                s.idSucursal = ?`, [
                cotizacion[0].idSucursal
            ]);

            if (sucursal.length === 0) {
                throw new ClientError("No se pudo obtener datos del sucursal, vuelve a recargar la vista.")
            }

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCotizacionDetalle ASC) AS id,
                p.idProducto,
                p.imagen,
                p.codigo,
                p.nombre AS producto,     

                m.nombre AS medida,
                c.nombre AS categoria, 

                cd.cantidad,
                cd.precio,

                i.idImpuesto,
                i.nombre AS impuesto,
                i.porcentaje
            FROM 
                cotizacionDetalle AS cd
            INNER JOIN 
                producto AS p ON p.idProducto = cd.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = cd.idMedida
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            INNER JOIN
                impuesto AS i ON i.idImpuesto = cd.idImpuesto
            WHERE 
                cd.idCotizacion = ?
            ORDER BY 
                cd.idCotizacionDetalle ASC`, [
                idCotizacion
            ]);

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1 AND idSucursal = ?`, [
                cotizacion[0].idSucursal
            ]);

            const subTotal = detalles.reduce((accumulator, item) => {
                const total = item.precio * item.cantidad;
                return accumulator + calculateTaxBruto(item.porcentaje, total);
            }, 0);

            const impuestos = detalles.reduce((
                accumulator,
                item,
            ) => {
                const total = item.cantidad * item.precio;
                const subTotal = calculateTaxBruto(item.porcentaje, total);
                const monto = calculateTax(item.porcentaje, subTotal);

                const existingImpuesto = accumulator.find(
                    (imp) => imp.idImpuesto === item.idImpuesto,
                );

                if (existingImpuesto) {
                    existingImpuesto.monto += monto;
                } else {
                    const tax = {
                        idImpuesto: item.idImpuesto,
                        nombre: item.impuesto,
                        monto: monto,
                    };
                    accumulator.push(tax);
                }

                return accumulator;
            },
                [],
            );

            const total = detalles.reduce(
                (accumulator, item) => accumulator + item.precio * item.cantidad,
                0,
            );

            const numeracion = formatNumberWithZeros(
                cotizacion[0].numeracion,
            );

            const title = `COTIZACIÓN ${cotizacion[0].serie}-${numeracion} - ${cotizacion[0].informacion}`;

            const template =
                type === 'document'
                    ? size === 'A4' ? 'cotizacion/document/a4' : 'cotizacion/document/ticket'
                    : 'cotizacion/preview/a4';

            const html = await renderTemplate(template, {
                formatDecimal,
                style: cssUrl,
                icon: logoUrl,
                title: title,
                empresa: {
                    ...empresa[0],
                    rutaLogo: firebaseService.getUrl(empresa[0].rutaLogo),
                },
                sucursal: {
                    ...sucursal[0],
                    ubigeo: {
                        departamento: sucursal[0].departamento,
                        provincia: sucursal[0].provincia,
                        distrito: sucursal[0].distrito
                    }
                },
                cotizacion: {
                    fecha: cotizacion[0].fecha,
                    hora: cotizacion[0].hora,
                    nota: cotizacion[0].nota,
                    comprobante: {
                        nombre: cotizacion[0].comprobante,
                        serie: cotizacion[0].serie,
                        numeracion: cotizacion[0].numeracion
                    },
                    cliente: {
                        documento: cotizacion[0].documento,
                        informacion: cotizacion[0].informacion,
                        direccion: cotizacion[0].direccion
                    },
                    moneda: {
                        nombre: cotizacion[0].moneda,
                        simbolo: cotizacion[0].simbolo,
                        codiso: cotizacion[0].codiso
                    },
                    usuario: {
                        apellidos: cotizacion[0].apellidos,
                        nombres: cotizacion[0].nombres
                    },
                },
                detalles: detalles.map(item => {
                    return {
                        id: item.id,
                        cantidad: item.cantidad,
                        precio: item.precio,
                        producto: {
                            codigo: item.codigo,
                            nombre: item.nombre,
                            imagen: firebaseService.getUrl(item.imagen) ?? noImageUrl,
                        },
                        medida: {
                            nombre: item.medida,
                        },
                        impuesto: {
                            idImpuesto: item.idImpuesto,
                            nombre: item.impuesto,
                            porcentaje: item.porcentaje,
                        },
                    }
                }),
                subTotal,
                impuestos,
                total,
                importLetras: new NumberLleters().getResult(
                    String(rounded(total)),
                    cotizacion[0].moneda,
                ),
                bancos: bancos
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
            return sendFile(res, response);
        } catch (error) {
            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Cotizacion/pdfDocumentOrPreview", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/pdfDocumentOrPreview", error);
        }
    }

    async pdfList(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/html-to-pdf`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    title: title,
                    htmlContent: `<html><body><h1>REPORTE</h1></body></html>`,
                    paper: {
                        paperType: "A4",
                        width: 0,
                        height: 0,
                    },
                    outputType: 'pdf'
                },
                timeout: 60000,
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/pdfList", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/quotation/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendSuccess(res, response.data);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cotizacion/documentsPdfExcel", error);
        }
    }
}

module.exports = Cotizacion;