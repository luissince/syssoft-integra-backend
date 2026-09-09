const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, toNullNumber, toNullString, formatDecimal, calculateTaxBruto, calculateTax, formatNumberWithZeros, renderTemplate, rounded } = require('../tools/Tools');
const { sendSuccess, sendError, sendSave, sendFile, sendClient } = require('../tools/Message');
const conec = require('../database/mysql-connection');
const { default: axios } = require('axios');
const firebaseService = require('../common/fire-base');
const { noImageUrl, cssUrl, logoUrl } = require('../common/constants/paths.constants');
const { CLIENT_INFO_REQUEST_NAMES } = require('../common/constants/names.constants');
const NumberLleters = require('../tools/NumberLleters');
const { ClientError } = require('../tools/Error');

class Pedido {

    async list(req, res) {
        try {
            const bucket = firebaseService.getBucket();

            const { opcion, buscar, fechaInicio, fechaFinal, idSucursal, ligado, estado, posicionPagina, filasPorPagina } = req.query;

            const lista = await conec.procedure(`CALL Listar_Pedidos(?,?,?,?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(buscar),
                toNullString(fechaInicio),
                toNullString(fechaFinal),
                toNullString(idSucursal),
                toNullNumber(ligado),
                toNullString(estado),

                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const newLista = await Promise.all(lista.map(async function (item, index) {
                const ligado = await conec.query(`
                    SELECT 
                        COUNT(*) AS total
                    FROM 
                        ventaPedido AS vc 
                    INNER JOIN 
                        venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3 
                    WHERE 
                        vc.idPedido = ?`, [
                    item.idPedido
                ]);


                if (req.clientInfo.app === CLIENT_INFO_REQUEST_NAMES.CATALOG_NEXT) {
                    const details = await conec.query(`
                    SELECT 
                        ROW_NUMBER() OVER (ORDER BY cd.idPedidoDetalle ASC) AS id,
                        p.idProducto,
                        p.imagen,
                        p.codigo,
                        p.nombre AS producto,

                        md.nombre AS medida, 
                        m.nombre AS categoria, 

                        cd.precio,
                        cd.cantidad,

                        cd.idImpuesto,
                        imp.nombre AS impuesto,
                        imp.porcentaje
                    FROM 
                        pedidoDetalle AS cd 
                    INNER JOIN 
                        producto AS p ON cd.idProducto = p.idProducto 
                    INNER JOIN 
                        medida AS md ON md.idMedida = cd.idMedida 
                    INNER JOIN 
                        categoria AS m ON p.idCategoria = m.idCategoria 
                    INNER JOIN 
                        impuesto AS imp ON cd.idImpuesto = imp.idImpuesto 
                    WHERE
                        cd.idPedido = ?
                    ORDER BY 
                        cd.idPedidoDetalle ASC`, [
                        item.idPedido
                    ]);

                    item.detalles = details.map(item => {
                        return {
                            ...item,
                            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                        }
                    }) || [];
                }

                return {
                    ...item,
                    ligado: ligado.length > 0 ? ligado[0].total : "LIBRE",
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            }));

            const total = await conec.procedure(`CALL Listar_Pedidos_Count(?,?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(buscar),
                toNullString(fechaInicio),
                toNullString(fechaFinal),
                toNullString(idSucursal),
                toNullNumber(ligado),
                toNullString(estado),
            ]);

            if (req.clientInfo.app === CLIENT_INFO_REQUEST_NAMES.CATALOG_NEXT) {
                return sendSuccess(res, this._mapListResponse(newLista, total[0].Total));
            }

            return sendSuccess(res, { "result": newLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/list", error)
        }
    }

    async id(req, res) {
        try {
            const { idPedido } = req.params;

            const cabecera = await conec.query(`
            SELECT 
                c.idTipoPedido,

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
                pedido AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idCliente
            WHERE 
                c.idPedido = ?`, [
                idPedido
            ]);

            const envio = await conec.query(`
            SELECT 
                e.direccion,
                e.referencia,

                e.idSucursal,
                
                DATE_FORMAT(e.fechaPedido, '%Y-%m-%d') AS fechaPedido,
                e.horaPedido,      
                
                e.idAgencia,
                e.destino,
                e.receptor
            FROM 
                pedidoEnvio AS e
            WHERE 
                e.idPedido = ?`, [
                idPedido
            ]);

            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idPedidoDetalle ASC) AS id,
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
                pedidoDetalle AS cd
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN 
                impuesto AS i ON cd.idImpuesto = i.idImpuesto
            WHERE 
                cd.idPedido = ?
            ORDER BY 
                cd.idPedidoDetalle ASC`, [
                idPedido
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                }
            });

            const idImpuesto = detalles[0]?.idImpuesto ?? '';
            cabecera[0].idImpuesto = idImpuesto;

            return sendSuccess(res, { cabecera: cabecera[0], envio: envio[0], detalles: listaDetalles });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/id", error)
        }
    }

    async detail(req, res) {
        try {
            const { idPedido } = req.params;

            // Consulta la información principal del pedido
            const pedido = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY p.idPedido ASC) AS id,
                p.idPedido,
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,

                tp.idTipoPedido,
                tp.nombre AS tipoPedido,

                s.idSucursal,
                s.nombre AS sucursal,

                co.nombre AS comprobante,
                p.serie,
                p.numeracion,

                cn.documento,
                cn.informacion,
                cn.telefono,
                cn.celular,
                cn.email,
                cn.direccion,      

                p.estado,
                p.observacion,
                p.nota,
                
                mo.codiso,

                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                pedido AS p
            INNER JOIN 
                comprobante AS co ON co.idComprobante = p.idComprobante
            INNER JOIN
                tipoPedido AS tp ON tp.idTipoPedido = p.idTipoPedido
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = p.idMoneda
            INNER JOIN 
                persona AS cn ON cn.idPersona = p.idCliente
            INNER JOIN
                sucursal s ON s.idSucursal = p.idSucursal
            INNER JOIN 
                usuario AS us ON us.idUsuario = p.idUsuario 
            WHERE 
                p.idPedido = ?`, [
                idPedido
            ]);

            // Consultar envio de pedido
            const envio = await conec.query(`
            SELECT 
                e.direccion,
                e.referencia,

                e.idSucursal,
                
                DATE_FORMAT(e.fechaPedido, '%Y-%m-%d') AS fechaPedido,
                e.horaPedido,      
                
                e.idAgencia,
                e.destino,
                e.receptor
            FROM 
                pedidoEnvio AS e
            WHERE 
                e.idPedido = ?`, [
                idPedido
            ]);

            // Consulta los detalles del pedido
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idPedidoDetalle ASC) AS id,
                p.idProducto,
                p.imagen,
                p.codigo,
                p.nombre AS producto,

                md.nombre AS medida, 
                m.nombre AS categoria, 

                cd.precio,
                cd.cantidad,

                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                pedidoDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = cd.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto 
            WHERE
                cd.idPedido = ?
            ORDER BY 
                cd.idPedidoDetalle ASC`, [
                idPedido
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: bucket && item.imagen
                        ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`
                        : null,
                }
            });

            // Consulta los ventas asociadas
            // const ventas = await conec.query(`
            //     SELECT 
            //         ROW_NUMBER() OVER (ORDER BY v.idVenta DESC) AS id,
            //         v.idVenta,
            //         DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha,
            //         v.hora,
            //         co.nombre AS comprobante,
            //         v.serie,
            //         v.numeracion,
            //         v.estado,
            //         m.codiso,
            //         SUM(vd.precio * vd.cantidad) AS total
            //     FROM 
            //         ventaPedido AS vc 
            //     INNER JOIN 
            //         pedido AS c ON c.idPedido = vc.idPedido
            //     INNER JOIN 
            //         venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            //     INNER JOIN 
            //         moneda AS m ON v.idMoneda = m.idMoneda
            //     INNER JOIN 
            //         ventaDetalle AS vd ON vd.idVenta = v.idVenta
            //     INNER JOIN 
            //         comprobante AS co ON co.idComprobante = v.idComprobante
            //     WHERE 
            //         vc.idPedido = ? 
            //     GROUP BY 
            //         v.idVenta, v.fecha, v.hora, co.nombre, v.serie, v.numeracion, v.estado,  m.codiso
            //     ORDER BY 
            //         v.fecha DESC, v.hora DESC`, [
            //     idPedido
            // ]);

            // const vendidos = await conec.query(`
            //     SELECT 
            //         p.idProducto,
            //         SUM(vd.cantidad) AS cantidad
            //     FROM 
            //         ventaPedido AS vc
            //     INNER JOIN
            //         venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            //     INNER JOIN
            //         ventaDetalle AS vd ON vd.idVenta = v.idVenta
            //     INNER JOIN
            //         producto AS p ON p.idProducto = vd.idProducto
            //     WHERE 
            //         vc.idPedido = ?
            //     GROUP BY 
            //         p.idProducto`, [
            //     idPedido
            // ]);

            // Si el cliente es el CATALOG_NEXT, devuelve el pedido en formato CATALOG_NEXT
            if (req.clientInfo.app === CLIENT_INFO_REQUEST_NAMES.CATALOG_NEXT) {
                return sendSuccess(res, this._mapDetailResponse(pedido[0], envio[0], listaDetalles));
            }

            // Si el cliente es el ADMIN_REACT, devuelve el pedido en formato ADMIN_REACT
            return sendSuccess(res, { cabecera: pedido[0], envio: envio[0], detalles: listaDetalles });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/detail", error)
        }
    }

    async forSale(req, res) {
        try {
            const validate = await conec.query(`
                SELECT 
                    *
                FROM 
                    pedido
                WHERE 
                    idPedido = ? AND estado IN ('pending', 'preparing', 'ready')`, [
                req.query.idPedido
            ]);

            if (validate.length !== 0) {
                return sendClient(res, "El pedido se encuentra anulado.");
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
                pedido AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idCliente
            WHERE 
                c.idPedido = ?`, [
                req.query.idPedido
            ]);

            const vendidos = await conec.query(`
                SELECT 
                    p.idProducto,
                    SUM(vd.cantidad) AS cantidad
                FROM 
                    ventaPedido AS vc
                INNER JOIN
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                INNER JOIN
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN
                    producto AS p ON p.idProducto = vd.idProducto
                WHERE 
                    vc.idPedido = ?
                GROUP BY 
                    p.idProducto`, [
                req.query.idPedido
            ]);

            const detalles = await conec.query(`
                SELECT 
                    cd.idProducto,
                    cd.precio,
                    cd.cantidad
                FROM
                    pedidoDetalle AS cd
                WHERE
                    cd.idPedido = ?
                ORDER BY 
                    cd.idPedidoDetalle ASC`, [
                req.query.idPedido
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
                const producto = await conec.query(`
                SELECT 
                    p.idProducto, 
                    p.codigo,
                    p.sku,
                    p.codigoBarras,
                    p.nombre AS nombreProducto, 
                    pc.valor AS precio,
                    p.preferido,
                    p.negativo,
                    c.nombre AS categoria, 
                    m.nombre AS medida,
                    p.idTipoTratamientoProducto,
                    p.imagen,

                    CASE 
                        WHEN 
                            p.idTipoProducto = 'TP0002' THEN 'SIN ALMACEN'
                        ELSE 
                            a.nombre
                    END AS almacen,
               
                    ROUND(CASE 
                        WHEN p.idTipoProducto = 'TP0002' THEN 0
                        ELSE IFNULL(i.cantidad, 0)
                    END, 2) AS cantidad,
                    
                    p.idTipoProducto
                FROM 
                    producto AS p
                INNER JOIN 
                    precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                INNER JOIN 
                    categoria AS c ON p.idCategoria = c.idCategoria
                INNER JOIN 
                    medida AS m ON m.idMedida = p.idMedida
                
                LEFT JOIN 
                    inventario AS i ON i.idProducto = p.idProducto 
                LEFT JOIN 
                    almacen AS a ON a.idAlmacen = i.idAlmacen

                WHERE 
                    p.idProducto = ?
                    AND 
                    (? IS NULL OR i.idAlmacen = ?)`, [
                    item.idProducto,
                    req.query.idAlmacen,
                    req.query.idAlmacen
                ]);

                const bucket = firebaseService.getBucket();
                const newProducto = {
                    ...producto[0],
                    precio: item.precio,
                    cantidad: item.cantidad,
                    imagen: bucket && producto[0].imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto[0].imagen}` : null,
                    id: index + 1
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cliente: cliente[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/detailVenta", error)
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idTipoPedido,
                pedidoEnvio,

                idSucursal,
                idUsuario,
                idMoneda,
                idComprobante,
                idCliente,
                observacion,
                nota,
                detalles
            } = req.body;

            const date = currentDate();
            const time = currentTime();

            // Genera un nuevo ID para el pedido
            const result = await conec.execute(connection, 'SELECT idPedido FROM pedido');
            const idPedido = generateAlphanumericCode("PD0001", result, 'idPedido');

            // Consulta datos del comprobante para generar la numeración
            const comprobante = await conec.execute(connection, `
            SELECT 
                serie,
                numeracion 
            FROM 
                comprobante 
            WHERE 
                idComprobante  = ?`, [
                idComprobante
            ]);

            // Consulta numeraciones de los pedidos  asociadas al mismo comprobante
            const pedidos = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                pedido 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            // Genera una nueva numeración para el pedido
            const numeracion = generateNumericCode(comprobante[0].numeracion, pedidos, "numeracion");

            await conec.execute(connection, `
            INSERT INTO pedido(
                idPedido,
                idTipoPedido,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,        
                observacion,
                nota,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idPedido,
                idTipoPedido,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                comprobante[0].serie,
                numeracion,
                observacion,
                nota,
                date,
                time,
            ]);

            await conec.execute(connection, `
            INSERT INTO pedidoEnvio(
                idPedido,
                direccion,
                referencia,
                idSucursal,
                fechaPedido,
                horaPedido,
                idAgencia,
                destino,
                receptor
            ) VALUES(?,?,?,?,?,?,?,?,?)`, [
                idPedido,
                pedidoEnvio.direccion,
                pedidoEnvio.referencia,
                pedidoEnvio.idSucursal,
                pedidoEnvio.fechaPedido,
                pedidoEnvio.horaPedido,
                pedidoEnvio.idAgencia,
                pedidoEnvio.destino,
                pedidoEnvio.receptor
            ]);

            // Genera un nuevo ID para los detalles del pedido
            const listaPedidoDetalle = await conec.execute(connection, 'SELECT idPedidoDetalle FROM pedidoDetalle');
            let idPedidoDetalle = generateNumericCode(1, listaPedidoDetalle, 'idPedidoDetalle');

            // Inserta los detalles de compra en la base de datos
            for (const detalle of detalles) {
                await conec.execute(connection, `
                INSERT INTO pedidoDetalle(
                    idPedidoDetalle,
                    idPedido,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idPedidoDetalle,
                    idPedido,
                    detalle.idProducto,
                    detalle.idMedida,
                    detalle.precio,
                    detalle.cantidad,
                    detalle.idImpuesto
                ]);

                idPedidoDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idPedido: idPedido,
                message: "Se registró correctamente el pedido."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/create", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idPedido,
                idTipoPedido,
                
                idSucursal,
                idUsuario,
                idMoneda,
                idCliente,
                observacion,
                nota,
                estado            } = req.body;


            const date = currentDate();
            const time = currentTime();

            const validate = await conec.execute(connection, `
            SELECT 
                *
            FROM 
                ventaPedido AS vc
            INNER JOIN
                venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            WHERE 
                vc.idPedido = ?`, [
                idPedido,
            ]);

            if (validate.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El pedido ya esta ligado a una venta y no se puede editar.");
            }

            await conec.execute(connection, `
            UPDATE 
                pedido 
            SET
                idTipoPedido = ?,
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
                idPedido = ?`, [
                idTipoPedido,
                idCliente,
                idUsuario,
                idSucursal,
                idMoneda,
                observacion,
                nota,
                estado,
                date,
                time,
                idPedido,
            ]);

            await conec.execute(connection, `
            DELETE FROM 
                pedidoDetalle
            WHERE 
                idPedido = ?`, [
                idPedido,
            ]);

            const listaPedidoDetalle = await conec.execute(connection, 'SELECT idPedidoDetalle FROM pedidoDetalle');
            let idPedidoDetalle = generateNumericCode(1, listaPedidoDetalle, 'idPedidoDetalle');

            // Inserta los detalles del pedido en la base de datos
            for (const item of req.body.detalles) {
                await await conec.execute(connection, `
                INSERT INTO pedidoDetalle(
                    idPedidoDetalle,
                    idPedido,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idPedidoDetalle,
                    idPedido,
                    item.idProducto,
                    item.idMedida,
                    item.precio,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idPedidoDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idPedido: req.body.idPedido,
                message: "Se actualizó correctamente el pedido."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido /update", error)
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
                ventaPedido AS vc
            INNER JOIN
                venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            WHERE 
                vc.idPedido = ?`, [
                req.query.idPedido
            ]);

            if (validate.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El pedido ya esta ligado a una venta y no se puede anular.");
            }

            const pedido = await conec.execute(connection, `
            SELECT
                estado
            FROM
                pedido
            WHERE
                idPedido = ?`, [
                req.query.idPedido
            ]);

            if (pedido.length === 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se encontro registros del pedido.");
            }

            if (pedido[0].estado === 'cancelled') {
                await conec.rollback(connection);
                return sendClient(res, "El pedido ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                pedido
            SET 
                estado = 'cancelled'
            WHERE
                idPedido = ?`, [
                req.query.idPedido
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente el pedido.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/cancel", error)
        }
    }

    async pdfDocumentOrPreview(req, res) {
        try {
            const { idPedido, type, size } = req.params;

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

            const pedido = await conec.query(`
            SELECT 
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,

                tp.idTipoPedido,
                tp.nombre AS tipoPedido,

                s.idSucursal,
                s.nombre AS sucursal,

                co.nombre AS comprobante,
                p.serie,
                p.numeracion,

                cn.documento,
                cn.informacion,
                cn.direccion,

                p.estado,
                p.observacion,
                p.nota,

                mo.codiso,
                mo.simbolo,
                mo.nombre AS moneda
            FROM 
                pedido AS p
            INNER JOIN 
                comprobante AS co ON co.idComprobante = p.idComprobante
            INNER JOIN
                tipoPedido AS tp ON tp.idTipoPedido = p.idTipoPedido
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = p.idMoneda
            INNER JOIN 
                persona AS cn ON cn.idPersona = p.idCliente
            INNER JOIN
                sucursal s ON s.idSucursal = p.idSucursal
            WHERE 
                p.idPedido = ?`, [
                idPedido
            ]);

            if (pedido.length === 0) {
                throw new ClientError("No se pudo obtener datos del pedido, vuelve a recargar la vista.");
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
                pedido[0].idSucursal
            ]);

            if (sucursal.length === 0) {
                throw new ClientError("No se pudo obtener datos del sucursal, vuelve a recargar la vista.")
            }

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idPedidoDetalle ASC) AS id,
                p.idProducto,
                p.imagen,
                p.codigo,
                p.nombre AS producto,

                md.nombre AS medida, 
                m.nombre AS categoria, 

                cd.precio,
                cd.cantidad,

                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                pedidoDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = cd.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto 
            WHERE
                cd.idPedido = ?
            ORDER BY 
                cd.idPedidoDetalle ASC`, [
                idPedido
            ]);

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1 AND estado = 1 AND idSucursal = ?`, [
                pedido[0].idSucursal
            ]);

            const bucket = firebaseService.getBucket();

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
                pedido[0].numeracion,
            );

            const title = `PEDIDO ${pedido[0].serie}-${numeracion} - ${pedido[0].informacion}`;


            const template =
                type === 'document'
                    ? size === 'A4' ? 'pedido/document/a4' : 'pedido/document/ticket'
                    : 'pedido/preview/a4';

            const html = await renderTemplate(template, {
                formatDecimal,
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
                pedido: {
                    fecha: pedido[0].fecha,
                    hora: pedido[0].hora,
                    nota: pedido[0].nota,
                    comprobante: {
                        nombre: pedido[0].comprobante,
                        serie: pedido[0].serie,
                        numeracion: numeracion
                    },
                    tipoPedido: {
                        idTipoPedido: pedido[0].idTipoPedido,
                        nombre: pedido[0].tipoPedido,
                    },
                    cliente: {
                        documento: pedido[0].documento,
                        informacion: pedido[0].informacion,
                        direccion: pedido[0].direccion
                    },
                    moneda: {
                        nombre: pedido[0].moneda,
                        simbolo: pedido[0].simbolo,
                        codiso: pedido[0].codiso
                    },
                    usuario: {
                        apellidos: pedido[0].apellidos,
                        nombres: pedido[0].nombres
                    },
                },
                detalles: detalles.map(item => {
                    return {
                        id: item.id,
                        cantidad: item.cantidad,
                        precio: item.precio,
                        producto: {
                            codigo: item.codigo,
                            nombre: item.producto,
                            imagen: item.imagen && bucket ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : noImageUrl,
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
                    pedido[0].moneda,
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
                return sendClient(res, error.message, "Pedido/cancel", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/cancel", error)
        }
    }

    async pdfList(res) {
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/order/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfExcel", error);
        }
    }

    _mapListResponse(list, count) {
        const orders = list.map((item) => {
            return {
                id: item.id,
                idOrder: item.idPedido,
                date: item.fecha,
                time: item.hora,

                typeOrder: {
                    idTypeOrder: item.idTipoPedido,
                    name: item.tipoPedido
                },

                receipt: {
                    name: item.comprobante,
                    series: item.serie,
                    number: item.numeracion,
                },

                person: {
                    document: item.documento,
                    information: item.informacion,
                    typeDocument: {
                        name: item.tipoDocumento
                    }
                },

                notes: item.nota,
                status: item.estado,

                currency: {
                    code: item.codiso,
                },

                total: item.total,

                orderDetails: item.detalles.map(item => {
                    return {
                        id: item.id,
                        idProduct: item.idProducto,
                        product: {
                            code: item.codigo,
                            name: item.producto,
                            image: item.imagen,
                        },

                        quantity: item.cantidad,
                        price: item.precio,

                        measure: {
                            name: item.medida,
                        },

                        category: {
                            name: item.categoria,
                        },

                        tax: {
                            id: item.idImpuesto,
                            name: item.impuesto,
                            rate: item.porcentaje,
                        },
                    }
                }),
            }
        });

        return {
            orders: orders,
            count: count,
        }
    }

    _mapDetailResponse(pedido, envio, detalles) {
        return {
            id: pedido.id,
            idOrder: pedido.idPedido,
            date: pedido.fecha,
            time: pedido.hora,
            typeOrder: {
                idTypeOrder: pedido.idTipoPedido,
                name: pedido.tipoPedido,
            },
            branch: {
                idBranch: pedido.idSucursal,
                name: pedido.sucursal,
            },
            receipt: {
                name: pedido.comprobante,
                series: pedido.serie,
                number: pedido.numeracion
            },
            person: {
                document: pedido.documento,
                information: pedido.informacion,
                phonerNumber: pedido.telefono,
                mobileNumber: pedido.celular,
                email: pedido.email,
                address: pedido.direccion
            },
            status: pedido.estado,
            observations: pedido.observacion,
            notes: pedido.nota,

            currency: {
                code: pedido.codiso
            },
            orderShipping: {
                address: envio.direccion,
                reference: envio.referencia,
                branch: {
                    idBranch: envio.idSucursal,
                    name: envio.sucursal,
                    address: envio.direccionSucursal
                },
                date: envio.fechaPedido,
                time: envio.horaPedido,
                agency: {
                    idAgency: envio.idAgencia,
                    name: envio.agencia,
                },
                destination: envio.destino,
                receiver: envio.receptor,
            },
            orderDetails: detalles.map(item => {
                return {
                    id: item.id,
                    idProduct: item.idProducto,
                    product: {
                        code: item.codigo,
                        name: item.producto,
                        image: item.imagen,
                    },
                    quantity: item.cantidad,
                    price: item.precio,
                    measure: {
                        name: item.medida,
                    },
                    category: {
                        name: item.categoria,
                    },
                    tax: {
                        id: item.idImpuesto,
                        name: item.impuesto,
                        rate: item.porcentaje,
                    },
                }
            })
        }
    }
}

module.exports = Pedido;