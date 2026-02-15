const { ClientError } = require('../../../tools/Error');
const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../../../tools/Tools');
const { PRODUCT_TREATMENTS_DIRECT, PRODUCT_TREATMENTS, KARDEX_TYPES, KARDEX_MOTIVOS } = require('../../../config/constants');

module.exports = ({ conec }) => async function create(body) {
    let connection = null;
    try {
        // Inicia la transacción
        connection = await conec.beginTransaction();

        // Obtener fecha y hora actuales
        const date = currentDate();
        const time = currentTime();

        const {
            idCotizacion,
            idPedido,
            idFormaPago,
        } = body;

        // Validación de cotización
        await validateCotizacion(connection, body);

        // Validación de pedido
        await validatePedido(connection, body);

        // Validación de inventario
        await validateInventario(connection, body);

        // Validación de productos inventariables
        await validateInventario(connection, body);

        // Validar si el cliente existe
        const nuevoIdCliente = await resolveCliente(connection, body);

        // Generar un código unico para la venta. 
        const idVenta = await insertVenta({
            connection,
            body,
            nuevoIdCliente,
            date,
            time
        });

        // Proceso para ingresar el detalle de la venta.
        await insertVentaDetalle({
            connection,
            body,
            idVenta,
            date,
            time
        });

        // Si la venta es al contado
        if (idFormaPago === "FP0001") {
            await insertTransaccionContado({
                connection,
                body,
                idVenta,
                date,
                time
            });
        }

        // Si la venta está asociada a una cotización
        if (idCotizacion) {
            await linkCotizacion({
                connection,
                body,
                idVenta,
                date,
                time
            });
        }

        // Si la venta está asociada a un pedido
        if (idPedido) {
            await linkPedido(connection, body);
        }

        // Confirmar la transacción
        await conec.commit(connection);

        // Enviar respuesta exitosa
        return {
            message: "Se completo el proceso correctamente.",
            idVenta: idVenta
        };
    } catch (error) {
        // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }

    async function validateCotizacion(connection, body) {
        const { idCotizacion, detalleVenta } = body;

        if (!idCotizacion) {
            return;
        }

        const vendidos = await conec.execute(connection, `
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

        const cotizacionDetalles = await conec.execute(connection, `
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
            if (item.tipo === "SERVICIO") {
                newDetallesVenta.push({
                    idProducto: item.idProducto,
                    cantidad: item.cantidad
                });
            }

            if (item.tipo === "PRODUCTO") {
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

                    if (PRODUCT_TREATMENTS_DIRECT.includes(item.idTipoTratamientoProducto)) {
                        cantidad = inventario.inventarioDetalles.reduce((sum, d) => sum + (d.cantidad || 0), 0);
                    } else if (item.idTipoTratamientoProducto === PRODUCT_TREATMENTS.VALOR_MONETARIO) {
                        cantidad = item.precio / producto[0].precio;
                    }

                    return sum + cantidad;
                }, 0);

                newDetallesVenta.push({
                    idProducto: item.idProducto,
                    cantidad
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

    async function validatePedido(connection, body) {
        const { idPedido, detalleVenta } = body;

        if (!idPedido) {
            return;
        }

        const vendidos = await conec.execute(connection, `
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

        const pedidoDetalles = await conec.execute(connection, `
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
            if (item.tipo === "PRODUCTO") {
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

                    if (PRODUCT_TREATMENTS_DIRECT.includes(item.idTipoTratamientoProducto)) {
                        cantidad = inventario.inventarioDetalles.reduce((sum, d) => sum + (d.cantidad || 0), 0);
                    } else if (item.idTipoTratamientoProducto === PRODUCT_TREATMENTS.VALOR_MONETARIO) {
                        cantidad = item.precio / producto[0].precio;
                    }

                    return sum + cantidad;
                }, 0);

                newDetallesVenta.push({
                    idProducto: item.idProducto,
                    cantidad
                });
            } else if (item.tipo === "SERVICIO") {
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

    async function validateInventario(connection, body) {
        const { detalleVenta } = body;

        let mensajeInventario = [];

        for (const item of detalleVenta) {
            if (item.tipo !== "PRODUCTO") continue;

            for (const inventario of item.inventarios) {
                const [inventarioActual] = await conec.execute(connection, `
                SELECT 
                    IFNULL(
                        SUM(
                            CASE 
                                WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad
                                ELSE -k.cantidad
                            END
                        ),
                    0) AS cantidad,
                    p.negativo
                FROM 
                    producto AS p
                LEFT JOIN 
                    kardex k ON k.idProducto = p.idProducto AND k.idAlmacen = ?
                WHERE 
                    p.idProducto = ?
                GROUP BY
                    p.idProducto,
                    p.negativo`, [
                    inventario.idAlmacen,
                    item.idProducto,
                ]);

                if (!inventarioActual) {
                    throw new ClientError("No se pudo obtener el inventario actual.");
                }

                if (inventarioActual.negativo === 0) {
                    const cantidadActual = inventario.inventarioDetalles.reduce((sum, d) => sum + (d.cantidad || 0), 0);
                    const cantidadReal = parseFloat(inventarioActual.cantidad);

                    if (cantidadActual > cantidadReal) {
                        mensajeInventario.push({
                            "nombre": item.nombreProducto,
                            "cantidadActual": cantidadActual,
                            "cantidadReal": cantidadReal
                        });
                    }
                }
            }
        }

        if (mensajeInventario.length > 0) {
            throw new ClientError("Cantidades insuficientes", mensajeInventario);
        }
    }

    async function resolveCliente(connection, body) {
        const { nuevoCliente, idCliente, idUsuario } = body;

        let nuevoIdCliente = "";

        if (nuevoCliente !== null && typeof nuevoCliente === 'object') {
            const cliente = await conec.execute(connection, `
                SELECT 
                    * 
                FROM 
                    persona 
                WHERE 
                    documento = ?`, [
                nuevoCliente.numeroDocumento
            ]);

            if (cliente.length === 0) {
                const result = await conec.execute(connection, 'SELECT idPersona FROM persona');
                const idPersona = generateAlphanumericCode("PN0001", result, 'idPersona');

                const tipoCliente = 1;
                const tipoProveedor = 0;
                const tipoConductor = 0;
                const predeterminado = 0;
                const estado = true;

                await conec.execute(connection, `
                INSERT INTO persona(
                    idPersona,
                    idTipoDocumento,
                    documento,
                    informacion,
                    cliente,
                    proveedor,
                    conductor,
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
                    tipoCliente,
                    tipoProveedor,
                    tipoConductor,
                    nuevoCliente.numeroCelular,
                    nuevoCliente.email,
                    nuevoCliente.direccion,
                    predeterminado,
                    estado,
                    date,
                    time,
                    idUsuario
                ]);

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

        return nuevoIdCliente;
    }

    async function insertVenta({
        connection,
        body,
        nuevoIdCliente,
        date,
        time
    }) {
        const {
            idComprobante,
            idSucursal,
            idMoneda,
            idUsuario,
            idFormaPago,
            idPlazo,
            observacion,
            nota,
            estado
        } = body;

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

        return idVenta;
    }

    async function insertVentaDetalle({
        connection,
        body,
        idVenta,
        date,
        time
    }) {
        const { detalleVenta, idUsuario } = body;

        // Generar el Id único
        const listaIdVentaDetalle = await conec.execute(connection, 'SELECT idVentaDetalle FROM ventaDetalle');
        let idVentaDetalle = generateNumericCode(1, listaIdVentaDetalle, 'idVentaDetalle');

        // Generar el Id único de Kardex
        const kardexIds = await conec.execute(connection, 'SELECT idKardex FROM kardex');
        let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

        const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

        // Proceso de registro  
        for (const item of detalleVenta) {
            if (item.tipo === "SERVICIO") {
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

            if (item.tipo === "PRODUCTO") {
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
                    for (const inventarioDetalle of inventario.inventarioDetalles) {
                        let cantidad = 0;

                        if (PRODUCT_TREATMENTS_DIRECT.includes(item.idTipoTratamientoProducto)) {
                            cantidad = inventarioDetalle.cantidad;
                        } else if (item.idTipoTratamientoProducto === PRODUCT_TREATMENTS.VALOR_MONETARIO) {
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
                            lote,
                            idUbicacion,
                            fechaVencimiento,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            item.idProducto,
                            KARDEX_TYPES.SALIDA,
                            KARDEX_MOTIVOS.SALIDA,
                            idVenta,
                            'SALIDA DEL PRODUCTO POR VENTA',
                            cantidad,
                            producto[0].costo,
                            inventario.idAlmacen,
                            inventarioDetalle.lote,
                            inventarioDetalle.idUbicacion,
                            inventarioDetalle.fechaVencimiento,
                            date,
                            time,
                            idUsuario
                        ]);
                    }
                }

                let cantidad = 0;
                let precio = 0;

                if (PRODUCT_TREATMENTS_DIRECT.includes(item.idTipoTratamientoProducto)) {
                    precio = item.precio;
                    cantidad = item.inventarios
                        .flatMap(inv => inv.inventarioDetalles)
                        .reduce((sum, d) => sum + (d.cantidad || 0), 0);
                }

                if (item.idTipoTratamientoProducto === PRODUCT_TREATMENTS.VALOR_MONETARIO) {
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
        }
    }

    async function insertTransaccionContado({
        connection,
        body,
        idVenta,
        date,
        time
    }) {
        const { idSucursal, notaTransacion, bancosAgregados, idUsuario } = body;

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

    async function linkCotizacion({
        connection,
        body,
        idVenta,
        date,
        time
    }) {
        const { idCotizacion, idUsuario } = body;

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
        ) VALUES (?,?,?,?,?,?)`, [
            idVentaCotizacion,
            idVenta,
            idCotizacion,
            date,
            time,
            idUsuario
        ]);
    }

    async function linkPedido({
        connection,
        body,
        idVenta,
        date,
        time
    }) {
        const { idPedido, idUsuario } = body;

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
        ) VALUES (?,?,?,?,?,?)`, [
            idVentaPedido,
            idVenta,
            idPedido,
            date,
            time,
            idUsuario
        ]);
    }
}
