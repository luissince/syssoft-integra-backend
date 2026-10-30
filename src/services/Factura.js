const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, formatDecimal, generateQr, rounded, formatNumberWithZeros, renderTemplate, calculateTaxBruto, calculateTax } = require('../tools/Tools');
const { sendSuccess, sendError, sendClient, sendSave, sendFile } = require('../tools/Message');
const axios = require('axios').default;
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');
const { TIPO_KARDEX, MOTIVO_KARDEX } = require('../common/constants/kardex.constants');
const { TIPO_PRODUCTO_NORMAL, TIPO_PRODUCTO_SERVICIO } = require('../common/constants/tipo-producto.constants');
const { ClientError } = require('../tools/Error');
const { cssUrl, logoUrl } = require('../common/constants/paths.constants');
const NumberLleters = require('../tools/NumberLleters');

class Factura {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Ventas(?,?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idComprobante,
                parseInt(req.query.estado),
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = await Promise.all(lista.map(async function (item, index) {
                const cobrado = await conec.query(`
                SELECT 
                    IFNULL(SUM(td.monto), 0)
                FROM 
                    transaccion AS t
                INNER JOIN 
                    transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                WHERE 
                    t.idReferencia = ? AND t.estado = 1`, [
                    item.idVenta,
                ]);

                const guiaRemision = await conec.query(`
                SELECT 
                    COUNT(*) AS total
                FROM 
                    guiaRemision as gui 
                WHERE 
                    gui.idVenta = ?`, [
                    item.idVenta
                ]);

                return {
                    ...item,
                    guiaRemision: guiaRemision.length > 0 ? guiaRemision[0].total : 0,
                    cobrado: cobrado[0].total ?? 0,
                    id: (index + 1) + parseInt(req.query.posicionPagina),
                }
            }));

            const total = await conec.procedure(`CALL Listar_Ventas_Count(?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idComprobante,
                parseInt(req.query.estado),
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idComprobante,
                idCliente,
                idUsuario,
                idSucursal,
                idMoneda,
                idCotizacion,
                idPedido,
                estado,
                observacion,
                nota,
                nuevoCliente,
                detalleVenta,

                idFormaPago,
                bancosAgregados,
                idPlazo,
                notaTransacion,
            } = req.body;

            // Obtener fecha y hora actuales
            const date = currentDate();
            const time = currentTime();

            if (idCotizacion) {
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

                const cotizacionDetalles = await conec.query(`
                    SELECT 
                        cd.idProducto,
                        cd.precio,
                        cd.cantidad
                    FROM
                        cotizacionDetalle AS cd
                    WHERE
                        cd.idCotizacion = ?`, [
                    idCotizacion
                ]);

                const newDetallesCotizacion = cotizacionDetalles.map((detalle) => {
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
                }).filter(Boolean);

                const newDetallesVenta = [];
                for (const item of detalleVenta) {
                    if (item.idTipoProducto === TIPO_PRODUCTO_NORMAL) {
                        const producto = await conec.execute(connection, `
                            SELECT 
                                p.costo, 
                                pc.valor AS precio 
                            FROM 
                                producto AS p 
                            INNER JOIN 
                                precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                            WHERE 
                                p.idProducto = ?`, [
                            item.idProducto,
                        ]);

                        const cantidad = item.inventarios.reduce((sum, inventario) => {
                            let cantidad = 0;

                            if (["TT0001", "TT0003", "TT0004"].includes(item.idTipoTratamientoProducto)) {
                                cantidad = inventario.cantidad;
                            } else if (item.idTipoTratamientoProducto === "TT0002") {
                                cantidad = item.precio / producto[0].precio;
                            }

                            return sum + cantidad;
                        }, 0);

                        newDetallesVenta.push({
                            idProducto: item.idProducto,
                            cantidad
                        });
                    }

                    if (item.idTipoProducto === TIPO_PRODUCTO_SERVICIO) {
                        newDetallesVenta.push({
                            idProducto: item.idProducto,
                            cantidad: item.cantidad
                        });
                    }
                }

                // 1️ Validación de cantidad de ítems
                if (newDetallesVenta.length > newDetallesCotizacion.length) {
                    throw new ClientError("El número de productos en la cotización no coincide con los productos vendidos.");
                }

                // 2 Validación de ids
                const ids1 = new Set(newDetallesCotizacion.map(obj => obj.idProducto));
                const ids2 = new Set(newDetallesVenta.map(obj => obj.idProducto));

                for (let id of ids2) {
                    if (!ids1.has(id)) {
                        throw new ClientError("Los productos vendidos no son iguales al de la cotización.");
                    }
                }

                // 3 Validación de cantidad de productos
                const map1 = new Map(newDetallesCotizacion.map(obj => [obj.idProducto, obj.cantidad]));
                const map2 = new Map(newDetallesVenta.map(obj => [obj.idProducto, obj.cantidad]));

                const diferencias = [];
                for (let [idProducto, cantidad] of map1) {
                    if (map2.has(idProducto)) {
                        if (map2.get(idProducto) > cantidad) {
                            diferencias.push(true);
                        }
                    }
                }

                if (diferencias.length > 0) {
                    throw new ClientError("Algunos productos tienen una cantidad diferente a la cotización.");
                }
            }

            if (idPedido) {
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
                    idPedido
                ]);

                const pedidoDetalles = await conec.query(`
                    SELECT 
                        cd.idProducto,
                        cd.precio,
                        cd.cantidad
                    FROM
                        pedidoDetalle AS cd
                    WHERE
                        cd.idPedido = ?`, [
                    idPedido
                ]);

                const newDetallesPedido = pedidoDetalles.map((detalle) => {
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
                }).filter(Boolean);

                const newDetallesVenta = [];
                for (const item of detalleVenta) {
                    if (item.idTipoProducto === TIPO_PRODUCTO_NORMAL) {
                        const producto = await conec.execute(connection, `
                            SELECT 
                                p.costo, 
                                pc.valor AS precio 
                            FROM 
                                producto AS p 
                            INNER JOIN 
                                precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                            WHERE 
                                p.idProducto = ?`, [
                            item.idProducto,
                        ]);

                        const cantidad = item.inventarios.reduce((sum, inventario) => {
                            let cantidad = 0;

                            if (["TT0001", "TT0003", "TT0004"].includes(item.idTipoTratamientoProducto)) {
                                cantidad = inventario.cantidad;
                            } else if (item.idTipoTratamientoProducto === "TT0002") {
                                cantidad = item.precio / producto[0].precio;
                            }

                            return sum + cantidad;
                        }, 0);

                        newDetallesVenta.push({
                            idProducto: item.idProducto,
                            cantidad
                        });
                    }

                    if (item.idTipoProducto === TIPO_PRODUCTO_SERVICIO) {
                        newDetallesVenta.push({
                            idProducto: item.idProducto,
                            cantidad: item.cantidad
                        });
                    }
                }

                // 1️ Validación de cantidad de ítems
                if (newDetallesVenta.length > newDetallesPedido.length) {
                    throw new ClientError("El número de productos en el pedido no coincide con los productos vendidos.");
                }

                // 2 Validación de ids
                const ids1 = new Set(newDetallesPedido.map(obj => obj.idProducto));
                const ids2 = new Set(newDetallesVenta.map(obj => obj.idProducto));

                for (let id of ids2) {
                    if (!ids1.has(id)) {
                        throw new ClientError("Los productos vendidos no son iguales al del pedido.");
                    }
                }

                // 3 Validación de cantidad de productos
                const map1 = new Map(newDetallesPedido.map(obj => [obj.idProducto, obj.cantidad]));
                const map2 = new Map(newDetallesVenta.map(obj => [obj.idProducto, obj.cantidad]));

                const diferencias = [];
                for (let [idProducto, cantidad] of map1) {
                    if (map2.has(idProducto)) {
                        if (map2.get(idProducto) > cantidad) {
                            diferencias.push(true);
                        }
                    }
                }

                if (diferencias.length > 0) {
                    throw new ClientError("Algunos productos tienen una cantidad diferente al pedido.");
                }
            }

            /**
             * Validación de productos inventariables
             */

            let validarInventario = 0;
            let mensajeInventario = [];

            for (const item of detalleVenta) {
                if (item.idTipoProducto === TIPO_PRODUCTO_NORMAL) {
                    for (const inventario of item.inventarios) {
                        const result = await conec.execute(connection, `
                        SELECT 
                            i.cantidad, 
                            p.negativo 
                        FROM 
                            inventario AS i
                        INNER JOIN 
                            almacen AS a ON a.idAlmacen = i.idAlmacen
                        INNER JOIN 
                            producto AS p ON p.idProducto = i.idProducto
                        WHERE 
                            i.idInventario = ? AND p.idProducto = ?`, [
                            inventario.idInventario,
                            item.idProducto,
                        ]);

                        if (result[0].negativo === 0) {
                            const cantidadActual = parseFloat(inventario.cantidad);
                            const cantidadReal = parseFloat(result[0].cantidad);

                            if (cantidadActual > cantidadReal) {
                                validarInventario++;

                                mensajeInventario.push({
                                    "codigo": item.codigo,
                                    "nombre": item.nombreProducto,
                                    "cantidadActual": cantidadActual,
                                    "cantidadReal": cantidadReal
                                });
                            }
                        }
                    }
                }
            }

            if (validarInventario > 0) {
                throw new ClientError("", { body: mensajeInventario });
            }

            /**
             * Validar si el cliente existe
             */

            let nuevoIdCliente = "";

            if (nuevoCliente !== null && typeof nuevoCliente === 'object') {
                const cliente = await conec.execute(connection, `SELECT * FROM persona WHERE documento = ?`, [
                    nuevoCliente.numeroDocumento
                ]);

                if (cliente.length === 0) {
                    const result = await conec.execute(connection, 'SELECT idPersona FROM persona');
                    const idPersona = generateAlphanumericCode("PN0001", result, 'idPersona');

                    await conec.execute(connection, `
                    INSERT INTO persona(
                        idPersona,
                        idTipoDocumento,
                        documento,
                        informacion,
                        cliente,
                        proveedor,
                        conductor,
                        licenciaConducir,
                        celular,
                        email,
                        direccion,
                        predeterminado,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        idPersona,
                        nuevoCliente.idTipoDocumento,
                        nuevoCliente.numeroDocumento,
                        nuevoCliente.informacion,
                        1,
                        0,
                        0,
                        '',
                        nuevoCliente.numeroCelular,
                        nuevoCliente.email,
                        nuevoCliente.direccion,
                        false,
                        true,
                        currentDate(),
                        currentTime(),
                        idUsuario
                    ])

                    nuevoIdCliente = idPersona;
                } else {
                    nuevoIdCliente = cliente[0].idPersona;
                }
            } else {
                nuevoIdCliente = idCliente;
            }

            if (!nuevoIdCliente) {
                throw new ClientError("No se genero el id de cliente, comuníquese con su proveedor de software.");
            }

            /**
             * Generar un código unico para la venta. 
             */
            const listVentas = await conec.execute(connection, 'SELECT idVenta FROM venta');
            const idVenta = generateAlphanumericCode("VT0001", listVentas, 'idVenta');

            /**
             * Obtener la serie y numeración del comprobante.
             */
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

            // Consulta numeraciones de ventas asociadas al mismo comprobante
            const ventas = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                venta 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            // Genera una nueva numeración para la venta
            const numeracion = generateNumericCode(comprobante[0].numeracion, ventas, "numeracion");

            // Obtener fecha de vencimiento sin el plazo no es null
            let fechaVencimiento = null;

            if (idPlazo) {
                const plazo = await conec.execute(connection, `
                SELECT 
                    dias 
                FROM 
                    plazo 
                WHERE 
                    idPlazo = ?`, [
                    idPlazo
                ]);

                if (plazo.length > 0) {
                    const current = new Date();
                    current.setDate(current.getDate() + parseInt(plazo[0].dias, 10));
                    fechaVencimiento = current;
                }
            }

            // Inserta la información principal de la venta en la base de datos
            await conec.execute(connection, `
            INSERT INTO venta(
                idVenta,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,                
                idFormaPago,
                idPlazo,
                fechaVencimiento,
                observacion,
                nota,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idVenta,
                nuevoIdCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                comprobante[0].serie,
                numeracion,
                idFormaPago,
                idPlazo,
                fechaVencimiento,
                observacion,
                nota,
                estado,
                date,
                time
            ]);

            /**
             * Proceso para ingresar el detalle de la venta.
             */

            // Generar el Id único
            const listaIdVentaDetalle = await conec.execute(connection, 'SELECT idVentaDetalle FROM ventaDetalle');
            let idVentaDetalle = generateNumericCode(1, listaIdVentaDetalle, 'idVentaDetalle');

            // Generar el Id único
            const kardexIds = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Proceso de registro  
            for (const item of detalleVenta) {
                if (item.idTipoProducto === TIPO_PRODUCTO_NORMAL) {
                    const producto = await conec.execute(connection, `
                    SELECT 
                        p.costo, 
                        pc.valor AS precio 
                    FROM 
                        producto AS p 
                    INNER JOIN 
                        precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                    WHERE 
                        p.idProducto = ?`, [
                        item.idProducto,
                    ]);

                    for (const inventario of item.inventarios) {
                        let cantidad = 0;

                        if (["TT0001", "TT0003", "TT0004",].includes(item.idTipoTratamientoProducto)) {
                            cantidad = inventario.cantidad;
                        } else if (item.idTipoTratamientoProducto === 'TT0002') {
                            cantidad = item.precio / producto[0].precio;
                        }

                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idVenta,
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
                            TIPO_KARDEX.SALIDA,
                            MOTIVO_KARDEX.SALIDA,
                            idVenta,
                            'SALIDA DEL PRODUCTO POR VENTA',
                            cantidad,
                            producto[0].costo,
                            inventario.idAlmacen,
                            inventario.idInventario,
                            date,
                            time,
                            idUsuario
                        ]);

                        await conec.execute(connection, `
                        UPDATE 
                            inventario 
                        SET
                            cantidad = cantidad - ? 
                        WHERE 
                            idInventario = ?`, [
                            cantidad,
                            inventario.idInventario
                        ]);
                    }

                    let cantidad = 0;
                    let precio = 0;

                    if (["TT0001", "TT0003", "TT0004",].includes(item.idTipoTratamientoProducto)) {
                        precio = item.precio;
                        cantidad = item.inventarios.reduce((acc, current) => acc + current.cantidad, 0);
                    } else if (item.idTipoTratamientoProducto === "TT0002") {
                        precio = producto[0].precio;
                        cantidad = item.precio / producto[0].precio;
                    }

                    await conec.execute(connection, `
                    INSERT INTO ventaDetalle(
                        idVentaDetalle,
                        idVenta,
                        idProducto,
                        descripcion,
                        precio,
                        cantidad,
                        idImpuesto
                    ) VALUES(?,?,?,?,?,?,?)`, [
                        idVentaDetalle,
                        idVenta,
                        item.idProducto,
                        item.nombreProducto,
                        precio,
                        cantidad,
                        item.idImpuesto
                    ]);

                    idVentaDetalle++;
                }

                if (item.idTipoProducto === TIPO_PRODUCTO_SERVICIO) {
                    await conec.execute(connection, `
                    INSERT INTO ventaDetalle(
                        idVentaDetalle,
                        idVenta,
                        idProducto,
                        descripcion,
                        precio,
                        cantidad,
                        idImpuesto
                    ) VALUES(?,?,?,?,?,?,?)`, [
                        idVentaDetalle,
                        idVenta,
                        item.idProducto,
                        item.nombreProducto,
                        item.precio,
                        item.cantidad,
                        item.idImpuesto
                    ])

                    idVentaDetalle++;
                }
            }

            // Si la venta es al contado
            if (idFormaPago === "FP0001") {
                const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
                let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

                await conec.execute(connection, `
                INSERT INTO transaccion(
                    idTransaccion,
                    idConcepto,
                    idReferencia,
                    idSucursal,
                    nota,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?)`, [
                    idTransaccion,
                    'CP0001',
                    idVenta,
                    idSucursal,
                    notaTransacion,
                    date,
                    time,
                    idUsuario
                ]);

                const listaTransaccionDetalle = await conec.execute(connection, 'SELECT idTransaccionDetalle FROM transaccionDetalle');
                let idTransaccionDetalle = generateNumericCode(1, listaTransaccionDetalle, 'idTransaccionDetalle');

                // Proceso de registro  
                for (const item of bancosAgregados) {
                    await conec.execute(connection, `
                    INSERT INTO transaccionDetalle(
                        idTransaccionDetalle,
                        idTransaccion,
                        idBanco,
                        monto,
                        observacion
                    ) VALUES(?,?,?,?,?)`, [
                        idTransaccionDetalle,
                        idTransaccion,
                        item.idBanco,
                        item.monto,
                        item.observacion
                    ]);

                    idTransaccionDetalle++;
                }
            }

            // Si la venta está asociada a una cotización
            if (idCotizacion) {
                const listaIdVentaCotizacion = await conec.execute(connection, 'SELECT idVentaCotizacion FROM ventaCotizacion');
                const idVentaCotizacion = generateNumericCode(1, listaIdVentaCotizacion, 'idVentaCotizacion');

                await conec.execute(connection, `
                INSERT INTO ventaCotizacion(
                    idVentaCotizacion, 
                    idVenta, 
                    idCotizacion, 
                    fecha, 
                    hora,
                    idUsuario
                ) 
                VALUES
                    (?,?,?,?,?,?)`, [
                    idVentaCotizacion,
                    idVenta,
                    idCotizacion,
                    date,
                    time,
                    idUsuario
                ]);
            }

            // Si la venta está asociada a un pedido
            if (idPedido) {
                const listaIdVentaPedido = await conec.execute(connection, 'SELECT idVentaPedido FROM ventaPedido');
                const idVentaPedido = generateNumericCode(1, listaIdVentaPedido, 'idVentaPedido');

                await conec.execute(connection, `
                INSERT INTO ventaCotizacion(
                    idVentaPedido, 
                    idVenta, 
                    idPedido, 
                    fecha, 
                    hora,
                    idUsuario
                ) 
                VALUES
                    (?,?,?,?,?,?)`, [
                    idVentaPedido,
                    idVenta,
                    idPedido,
                    date,
                    time,
                    idUsuario
                ]);
            }

            await conec.commit(connection);
            return sendSave(res, {
                message: "Se completo el proceso correctamente.",
                idVenta: idVenta
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            if (error instanceof ClientError) {
                return sendClient(res, error.message || error.body, "Factura/create", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/create", error);
        }
    }

    async detail(req, res) {
        try {
            // Obtener información general de la venta
            const result = await conec.query(`
            SELECT
                DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha,
                v.hora, 

                co.nombre AS comprobante,                
                v.serie,
                v.numeracion,

                cn.documento,
                cn.informacion,
                cn.direccion,
                cn.celular,
                cn.email,

                fc.idFormaPago,
                fc.nombre AS formaPago,
            
                v.estado, 
                v.observacion,
                v.nota,

                mo.codiso,                

                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                venta AS v 
            INNER JOIN 
                comprobante AS co ON co.idComprobante = v.idComprobante
            INNER JOIN 
                formaPago AS fc ON fc.idFormaPago = v.idFormaPago
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = v.idMoneda
            INNER JOIN 
                persona AS cn ON cn.idPersona = v.idCliente                       
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            WHERE 
                v.idVenta = ?`, [
                req.query.idVenta
            ]);

            // Obtener detalles de productos vendidos en la venta
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY vd.idVentaDetalle ASC) AS id,
                p.codigo,
                p.nombre AS producto,
                p.imagen,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                vd.precio,
                vd.cantidad,
                vd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                ventaDetalle AS vd 
            INNER JOIN 
                producto AS p ON vd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE 
                vd.idVenta = ?
            ORDER BY 
                vd.idVentaDetalle ASC`, [
                req.query.idVenta
            ]);

            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                }
            });

            // Obtener información de transacciones asociados a la venta
            const transacciones = await conec.query(`
            SELECT 
                t.idTransaccion,
                DATE_FORMAT(t.fecha,'%d/%m/%Y') AS fecha,
                t.hora,
                c.nombre AS concepto,
                t.nota,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                transaccion t            
            INNER JOIN
                concepto c ON c.idConcepto = t.idConcepto
            INNER JOIN 
                usuario AS us ON us.idUsuario = t.idUsuario 
            WHERE 
                t.idReferencia = ?`, [
                req.query.idVenta
            ]);

            for (const transaccion of transacciones) {
                const detalles = await conec.query(`
                    SELECT 
                        b.nombre,
                        td.monto,
                        td.observacion
                    FROM
                        transaccionDetalle td
                    INNER JOIN 
                        banco b on td.idBanco = b.idBanco     
                    WHERE 
                        td.idTransaccion = ?`, [
                    transaccion.idTransaccion
                ]);

                transaccion.detalles = detalles;
            }

            // Enviar respuesta exitosa con la información recopilada
            return sendSuccess(res, { "cabecera": result[0], detalles: listaDetalles, transacciones });
        } catch (error) {
            // Manejar errores y enviar mensaje de error al cliente
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/detail", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            // Iniciar una transacción
            connection = await conec.beginTransaction();

            const {
                idVenta,
                idUsuario,
            } = req.query;

            // Obtener fecha y hora actuales
            const date = currentDate();
            const time = currentTime();

            // Obtener información de la venta para el id proporcionado
            const validate = await conec.execute(connection, `
                SELECT 
                    serie, 
                    numeracion, 
                    estado 
                FROM 
                    venta 
                WHERE 
                    idVenta = ?`, [
                idVenta
            ]);

            // Verificar si la venta existe
            if (validate.length === 0) {
                throw new ClientError("La venta no existe, verifique el código o actualiza la lista.");
            }

            // Verificar si la venta ya está anulada
            if (validate[0].estado === 3) {
                throw new ClientError("La venta ya se encuentra anulada.");
            }

            // Actualizar el estado de la venta a anulado
            await conec.execute(connection, `
                UPDATE 
                    venta 
                SET 
                    estado = 3 
                WHERE 
                    idVenta = ?`, [
                idVenta
            ]);

            // Actualizar el estado de transacción
            await conec.execute(connection, `
                UPDATE 
                    transaccion 
                SET 
                    estado = 0 
                WHERE 
                    idReferencia = ?`, [
                idVenta
            ]);

            // Obtener detalles de la venta
            const detalleVenta = await conec.execute(connection, `
                SELECT 
                    idProducto, 
                    precio, 
                    cantidad 
                FROM 
                    ventaDetalle 
                WHERE 
                    idVenta = ?`, [
                idVenta
            ]);

            // Obtener el máximo idKardex existente
            const kardexIds = await conec.execute(connection, `SELECT idKardex FROM kardex`);
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Procesar cada detalle de la venta
            for (const detalle of detalleVenta) {
                // Obtener registros de kardex relacionados con esta venta y producto
                const kardex = await conec.execute(connection, `
                    SELECT 
                        k.idProducto,
                        k.cantidad,
                        k.costo,
                        k.idAlmacen,
                        k.idInventario
                    FROM 
                        kardex AS k 
                    WHERE 
                        k.idVenta = ? AND k.idProducto = ?`, [
                    idVenta,
                    detalle.idProducto
                ]);

                for (const item of kardex) {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idVenta,
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
                        TIPO_KARDEX.INGRESO,
                        MOTIVO_KARDEX.DEVOLUCION,
                        idVenta,
                        'ANULACIÓN DE LA VENTA',
                        item.cantidad,
                        item.costo,
                        item.idAlmacen,
                        item.idInventario,
                        date,
                        time,
                        idUsuario
                    ]);

                    // Actualizar la cantidad en el inventario
                    await conec.execute(connection, `
                        UPDATE 
                            inventario 
                        SET 
                            cantidad = cantidad + ?
                        WHERE 
                            idInventario = ?`, [
                        item.cantidad,
                        item.idInventario,
                    ]);
                }
            }

            // Confirmar la transacción
            await conec.commit(connection);

            // Enviar respuesta exitosa
            return sendSave(res, "Se anuló correctamente la venta.");
        } catch (error) {
            // Manejar errores y realizar rollback en caso de problemas
            if (connection != null) {
                await conec.rollback(connection);
            }

            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Factura/cancel", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/cancel", error);
        }
    }

    async filter(req, res) {
        try {
            const { filter, idSucursal } = req.params;

            const result = await conec.query(`
            SELECT 
                v.idVenta,

                co.nombre AS nombreComprobante,
                v.serie,
                v.numeracion,

                p.documento,
                p.informacion,
                p.direccion,

                IFNULL(u.idUbigeo,0) AS idUbigeo,
                IFNULL(u.departamento,'') AS departamento,
                IFNULL(u.provincia,'') AS provincia,
                IFNULL(u.distrito,'') AS distrito,
                IFNULL(u.ubigeo,'') AS ubigeo
            FROM venta AS v
            INNER JOIN comprobante AS co
                ON co.idComprobante = v.idComprobante
            INNER JOIN persona AS p
                ON p.idPersona = v.idCliente
            LEFT JOIN ubigeo AS u
                ON u.idUbigeo = p.idUbigeo
            WHERE
                v.idSucursal = ?
                AND
                (
                    v.serie LIKE CONCAT('%', ?, '%')
                OR 
                    v.numeracion LIKE CONCAT('%', ?, '%')
                OR 
                    CONCAT(v.serie, '-', v.numeracion) LIKE CONCAT('%', ?, '%')
                OR 
                    co.nombre LIKE CONCAT('%', ?, '%')
                )`, [
                idSucursal,
                filter,
                filter,
                filter,
                filter,
            ]);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/filter", error);
        }
    }

    async shippingGuide(req, res) {
        try {
            const { idVenta } = req.params;

            const result = await conec.query(`
            SELECT 
                v.idVenta,
                
                co.nombre AS nombreComprobante,
                v.serie,
                v.numeracion,

                p.documento,
                p.informacion,
                p.direccion,

                IFNULL(u.idUbigeo,0) AS idUbigeo,
                IFNULL(u.departamento,'') AS departamento,
                IFNULL(u.provincia,'') AS provincia,
                IFNULL(u.distrito,'') AS distrito,
                IFNULL(u.ubigeo,'') AS ubigeo
            FROM
                venta AS v
            INNER JOIN 
                comprobante AS co ON co.idComprobante = v.idComprobante
            INNER JOIN 
                persona AS p ON p.idPersona = v.idCliente
            LEFT JOIN
                ubigeo AS u ON u.idUbigeo = p.idUbigeo
            WHERE                 
                v.idVenta = ?`, [
                idVenta,
            ]);

            if (result.length === 0) {
                throw new Error("No se encontro registros de la venta.");
            }

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/shippingGuide", error);
        }
    }

    async shippingGuideDetails(req, res) {
        try {
            const { idVenta } = req.params;

            // Obtener detalles de productos vendidos en la venta
            const details = await conec.query(`
            SELECT 
                p.codigo,
                vd.idProducto,
                p.nombre AS producto,
                md.nombre AS medida, 
                p.imagen,
                vd.cantidad
            FROM 
                ventaDetalle AS vd 
            INNER JOIN 
                producto AS p ON vd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            WHERE 
                vd.idVenta = ?
            ORDER BY 
                vd.idVentaDetalle ASC`, [
                idVenta
            ]);

            const newDetails = details.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                }
            });

            // Enviar respuesta exitosa con la información recopilada
            return sendSuccess(res, newDetails);
        } catch (error) {
            // Manejar errores y enviar mensaje de error al cliente
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/shippingGuideDetails", error);
        }
    }

    async forSale(req, res) {
        try {
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
                venta AS v
            INNER JOIN 
                persona AS p ON p.idPersona = v.idCliente
            WHERE 
                v.idVenta = ?`, [
                req.query.idVenta
            ]);

            const detalles = await conec.query(`
            SELECT 
                vd.idProducto,
                vd.descripcion,
                vd.precio,
                vd.cantidad
            FROM
                ventaDetalle AS vd
            WHERE
                vd.idVenta = ?
            ORDER BY 
                vd.idVentaDetalle ASC`, [
                req.query.idVenta
            ]);

            let productos = [];
            let index = 0;

            for (const item of detalles) {
                const producto = await conec.procedure(`CALL Filtrar_Productos_Para_Venta(?,?,?,?,?)`, [
                    3,
                    item.idProducto,
                    req.query.idAlmacen,
                    0,
                    1
                ]);

                const newProducto = {
                    ...producto[0],
                    nombreProducto: item.descripcion,
                    precio: item.precio,
                    cantidad: item.cantidad,
                    imagen: firebaseService.getUrl(producto[0].imagen),
                    id: index + 1
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la venta, los detalles y las salidas
            return sendSuccess(res, { cliente: cliente[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/forSale", error)
        }
    }

    async createAccountsReceivable(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idVenta,
                idSucursal,
                idUsuario,
                monto,
                notaTransacion,
                bancosAgregados,
            } = req.body;

            const fecha = currentDate();
            const hora = currentTime();

            const venta = await conec.query(`
            SELECT 
                estado
            FROM 
                venta
            WHERE 
                idVenta = ?`, [
                idVenta
            ]);

            if (venta[0].estado !== 2) {
                throw new ClientError("La venta ya se encuentra anulada o no tiene pagos pendientes.");
            }

            const resumen = await conec.execute(connection, `
            SELECT 
                SUM(vd.cantidad * vd.precio) AS total,
                (
                    SELECT 
                        IFNULL(SUM(td.monto), 0)
                    FROM 
                        transaccion AS t
                    INNER JOIN 
                        transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                    WHERE 
                        t.idReferencia = v.idVenta AND t.estado = 1
                ) AS pagado
            FROM 
                venta AS v 
            INNER JOIN 
                ventaDetalle AS vd ON vd.idVenta = v.idVenta
            WHERE 
                v.idVenta = ?`, [
                idVenta
            ]);

            if (monto > (resumen[0].total - resumen[0].pagado)) {
                throw new ClientError("El monto no puede superar al saldo pendiente.");
            }

            if (monto + resumen[0].pagado >= resumen[0].total) {
                await conec.execute(connection, `
                        UPDATE 
                            venta
                        SET 
                            estado = 1
                        WHERE 
                            idVenta = ?`, [
                    idVenta
                ]);
            }

            // Proceso de registro  
            const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
            let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

            await conec.execute(connection, `
            INSERT INTO transaccion(
                idTransaccion,
                idConcepto,
                idReferencia,
                idSucursal,
                nota,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                'CP0003',
                idVenta,
                idSucursal,
                notaTransacion,
                fecha,
                hora,
                idUsuario
            ]);

            const listaTransaccionDetalle = await conec.execute(connection, 'SELECT idTransaccionDetalle FROM transaccionDetalle');
            let idTransaccionDetalle = generateNumericCode(1, listaTransaccionDetalle, 'idTransaccionDetalle');

            for (const item of bancosAgregados) {
                await conec.execute(connection, `
                INSERT INTO transaccionDetalle(
                    idTransaccionDetalle,
                    idTransaccion,
                    idBanco,
                    monto,
                    observacion
                ) VALUES(?,?,?,?,?)`, [
                    idTransaccionDetalle,
                    idTransaccion,
                    item.idBanco,
                    item.monto,
                    item.observacion
                ]);

                idTransaccionDetalle++;
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente el cobro.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/colletAccountReceivable", error);
        }
    }

    async cancelAccountsReceivable(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            const transaccion = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    transaccion AS t
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = t.idTransaccion
                WHERE 
                    t.idTransaccion = ?`, [
                req.query.idTransaccion,
            ]);

            const transacciones = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    transaccion AS t
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = t.idTransaccion
                WHERE 
                    t.idReferencia = ? AND t.estado = 1`, [
                req.query.idVenta
            ]);

            const sumaTransacciones = transacciones.reduce((accumulator, item) => accumulator + item.monto, 0);

            const venta = await conec.query(`
                SELECT 
                    SUM(cd.cantidad * cd.precio) AS total
                FROM 
                    venta AS v
                INNER JOIN 
                    ventaDetalle AS cd ON cd.idVenta = v.idVenta
                WHERE 
                    v.idVenta = ?`, [
                req.query.idVenta
            ]);

            if (sumaTransacciones - transaccion[0].monto < venta[0].total) {
                await conec.execute(connection, `
                    UPDATE 
                        vente
                    SET 
                        estado = 2
                    WHERE 
                        idVenta = ?`, [
                    req.query.idVenta
                ]);
            }

            await conec.execute(connection, `
                UPDATE 
                    transaccion 
                SET 
                    estado = 0 
                WHERE 
                    idTransaccion = ?`, [
                req.query.idTransaccion
            ]);

            await conec.execute(connection, `    
                INSERT INTO auditoria(
                    idReferencia,
                    idUsuario,
                    tipo,
                    descripción
                ) VALUES(?,?,?,?)`, [
                req.query.idTransaccion,
                req.query.idUsuario,
                "ELIMINAR",
                "SE ANULO LA TRANSACCIÓN DE VENTA",
                date,
                time,
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se anuló correctamente su cobro.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/createAccountsPayable", error);
        }
    }

    async pdfDocumentOrPreview(req, res) {
        try {
            const { idVenta, size, type, outputType = "pdf" } = req.params;

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

            const venta = await conec.query(`
            SELECT 
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,
                p.idSucursal,
                p.nota,
                --
                c.nombre AS comprobante,
                p.serie,
                p.numeracion,
                c.facturado,
                --
                cp.documento,
                cp.informacion,
                cp.direccion,
                --
                fp.nombre AS formaPago,
                --
                m.nombre AS moneda,
                m.simbolo,
                m.codiso,
                --
                u.apellidos,
                u.nombres
            FROM 
                venta AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idCliente
            INNER JOIN
                formaPago AS fp ON fp.idFormaPago = p.idFormaPago
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idVenta = ?`, [
                idVenta
            ]);

            if (venta.length === 0) {
                throw new ClientError("No se pudo obtener datos de la venta, vuelve a recargar la vista.");
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
                venta[0].idSucursal
            ]);

            if (sucursal.length === 0) {
                throw new ClientError("No se pudo obtener datos del sucursal, vuelve a recargar la vista.")
            }

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idVentaDetalle ASC) AS id,
                p.codigo,
                p.nombre,
                gd.cantidad,
                gd.precio,
                m.nombre AS medida,
                i.idImpuesto,
                i.nombre AS impuesto,
                i.porcentaje
            FROM 
                ventaDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN
                impuesto AS i ON i.idImpuesto = gd.idImpuesto
            WHERE 
                gd.idVenta = ?
            ORDER BY 
                gd.idVentaDetalle ASC`, [
                idVenta
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
                venta[0].idSucursal
            ]);

            const buffer = await generateQr('https://www.syssoftintegra.com/');
            const base64QR = buffer.toString('base64');

            const subTotal = detalles.reduce((accumulator, item) => {
                const total = item.precio * item.cantidad;
                return accumulator + calculateTaxBruto(item.impuesto.porcentaje, total);
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
                venta[0].numeracion,
            );
            const title = `VENTA ${venta[0].serie}-${numeracion} - ${venta[0].informacion}`;

            const template =
                type === 'document'
                    ? size === 'A4' ? 'venta/document/a4' : 'venta/document/ticket'
                    : 'venta/preview/a4';

            const html = await renderTemplate(template, {
                formatDecimal,
                style: cssUrl,
                icon: logoUrl,
                title: title,
                base64QR,
                empresa: {
                    ...empresa[0],
                    rutaLogo: firebaseService.getUrl(empresa[0].rutaLogo),
                },
                sucursal: {
                    nombre: sucursal[0].nombre,
                    telefono: sucursal[0].telefono,
                    celular: sucursal[0].celular,
                    email: sucursal[0].email,
                    paginaWeb: empresa[0].paginaWeb,
                    direccion: sucursal[0].direccion,
                    ubigeo: {
                        departamento: sucursal[0].departamento,
                        provincia: sucursal[0].provincia,
                        distrito: sucursal[0].distrito
                    }
                },
                venta: {
                    fecha: venta[0].fecha,
                    hora: venta[0].hora,
                    nota: venta[0].nota,
                    comprobante: {
                        nombre: venta[0].comprobante,
                        serie: venta[0].serie,
                        numeracion: venta[0].numeracion,
                        facturado: venta[0].facturado
                    },
                    cliente: {
                        documento: venta[0].documento,
                        informacion: venta[0].informacion,
                        direccion: venta[0].direccion
                    },
                    formaPago: {
                        nombre: venta[0].formaPago
                    },
                    moneda: {
                        nombre: venta[0].moneda,
                        simbolo: venta[0].simbolo,
                        codiso: venta[0].codiso
                    },
                    usuario: {
                        apellidos: venta[0].apellidos,
                        nombres: venta[0].nombres
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
                            medida: {
                                nombre: item.medida,
                            }
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
                    venta[0].moneda,
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
                    outputType: outputType
                },
                timeout: 60000,
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/pdfDocumentOrPreview", error);
        }
    }

    async documentsPdfAccountsReceivable(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/sale/pdf/account/receivable`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "size": req.params.size
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/documentsPdfAccountsPayable", error);
        }
    }

    async documentsPdfReports(req, res) {
        try {
            const { size, outputType = "pdf" } = req.params;

            const template = 'venta/list/a4';

            const title = 'REPORTE VENTAS';

            const data = await conec.procedureAll(`CALL Reporte_Venta_Global('2026-01-01', '2026-10-31', '', '')`)

            const html = await renderTemplate(template, {
                formatDecimal,
                style: cssUrl,
                icon: logoUrl,
                title: title,
                data
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
                    outputType: outputType
                },
                timeout: 60000,
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/sale/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/documentsPdfExcel", error);
        }
    }

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Venta(?,?,?,?,?,?)`, [
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                req.query.idUsuario,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            return sendSuccess(res, {
                "contado": result[0][0].total ?? 0,
                "credito": result[1][0].total ?? 0,
                "anulado": result[2][0].total ?? 0,
                "cobrado": result[3][0].total ?? 0,
                "listaPorMeses": result[4] ?? [],
                "listaPorComprobante": result[5] ?? [],
                "lista": result[6] ?? [],
                "total": result[7][0].total ?? 0,
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/dashboard", error);
        }
    }

}

module.exports = Factura;