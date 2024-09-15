const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendClient, sendSave } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

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

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

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

    async listCpeSunat(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_CPE_Sunat(?,?,?,?,?,?,?,?,?)`, [
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

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_CPE_Sunat_Count(?,?,?,?,?,?,?)`, [
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/listCpeSunat", error);
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
                estado,
                comentario,
                nuevoCliente,
                detalleVenta,

                idFormaPago,
                bancosAgregados,
                numeroCuotas,
                frecuenciaPago,
                notaTransacion,
                importeTotal
            } = req.body;

            /**
             * Validación de productos inventariables
             */

            let validarInventario = 0;
            let mensajeInventario = [];

            for (const item of detalleVenta) {
                if (item.tipo === "PRODUCTO") {
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
                await conec.rollback(connection);
                return sendClient(res, { "message": "error de 0", body: mensajeInventario });
            }

            /**
             * Validar si el cliente existe
             */

            let nuevoIdCliente = "";

            if (nuevoCliente !== null && typeof nuevoCliente === 'object') {
                const cliente = await conec.execute(connection, `SELECT * FROM persona WHERE documento = ?`, [
                    nuevoCliente.numeroDocumento
                ])

                if (cliente.length === 0) {
                    const result = await conec.execute(connection, 'SELECT idPersona FROM persona');
                    const idPersona = generateAlphanumericCode("PN0001", result, 'idPersona');

                    await conec.execute(connection, `
                    INSERT INTO persona(
                        idPersona,
                        idTipoCliente,
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
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        idPersona,
                        nuevoCliente.idTipoCliente,
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
                await conec.rollback(connection);
                return sendClient(res, "No se genero el id de cliente, comuníquese con su proveedor de software.");
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

            const ventas = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                venta 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, ventas, "numeracion");

            /**
             * Proceso para ingresar una venta.
             */

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
                numeroCuota,
                frecuenciaPago,
                comentario,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idVenta,
                nuevoIdCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                comprobante[0].serie,
                numeracion,
                idFormaPago,
                !numeroCuotas ? 0 : numeroCuotas,
                !frecuenciaPago ? null : frecuenciaPago,
                comentario,
                estado,
                currentDate(),
                currentTime()
            ]);

            /**
             * Proceso para ingresar el detalle de la venta.
             */

            // Generar el Id único
            const listaIdVentaDetalle = await conec.execute(connection, 'SELECT idVentaDetalle FROM ventaDetalle');
            let idVentaDetalle = generateNumericCode(1, listaIdVentaDetalle, 'idVentaDetalle');

            // Generar el Id único
            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Proceso de registro  
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

                    for (const inventario of item.inventarios) {
                        let cantidad = 0;

                        if (item.idTipoTratamientoProducto === 'TT0001' || item.idTipoTratamientoProducto === 'TT0004' || item.idTipoTratamientoProducto === 'TT0003') {
                            cantidad = inventario.cantidad;
                        }

                        if (item.idTipoTratamientoProducto === 'TT0002') {
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
                            hora,
                            fecha,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            `KD${String(idKardex += 1).padStart(4, '0')}`,
                            item.idProducto,
                            'TK0002',
                            'MK0003',
                            idVenta,
                            'SALIDA DEL PRODUCTO POR VENTA',
                            cantidad,
                            producto[0].costo,
                            inventario.idAlmacen,
                            inventario.idInventario,
                            currentTime(),
                            currentDate(),
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

                    if (item.idTipoTratamientoProducto === 'TT0001' || item.idTipoTratamientoProducto === 'TT0004' || item.idTipoTratamientoProducto === 'TT0003') {
                        precio = item.precio;
                        cantidad = item.inventarios.reduce((acc, current) => acc + current.cantidad, 0);
                    }

                    if (item.idTipoTratamientoProducto === 'TT0002') {
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
                    ])

                    idVentaDetalle++;
                }

                if (item.tipo === "SERVICIO") {
                    await conec.execute(connection, `INSERT INTO ventaDetalle(
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

            /**
             * Proceso cuando la venta es al contado
             */
            if (idFormaPago === "FP0001") {
                const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
                let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

                await conec.execute(connection, `
                    INSERT INTO transaccion(
                        idTransaccion,
                        idConcepto,
                        idReferencia,
                        nota,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?)`, [
                    idTransaccion,
                    'CP0001',
                    idVenta,
                    notaTransacion,
                    1,
                    currentDate(),
                    currentTime(),
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

            /**
            * Proceso cuando la venta es al crédito fijo
            */
            if (idFormaPago === "FP0002") {
                const listCuotas = await conec.execute(connection, 'SELECT idCuota FROM cuota');
                let idCuota = generateNumericCode(1, listCuotas, 'idCuota');

                let current = new Date();

                let monto = importeTotal / parseFloat(numeroCuotas);

                let i = 0;
                let cuota = 0;
                while (i < numeroCuotas) {
                    let now = new Date(current);

                    if (parseInt(frecuenciaPago) > 15) {
                        now.setDate(now.getDate() + 30);
                    } else {
                        now.setDate(now.getDate() + 15);
                    }

                    i++;
                    cuota++;

                    await conec.execute(connection, `
                    INSERT INTO cuota(
                        idCuota,
                        idVenta,
                        cuota,
                        fecha,
                        hora,
                        monto,
                        estado
                    ) VALUES(?,?,?,?,?,?,?)`, [
                        idCuota,
                        idVenta,
                        cuota,
                        now.getFullYear() + "-" + ((now.getMonth() + 1) < 10 ? "0" + (now.getMonth() + 1) : (now.getMonth() + 1)) + "-" + now.getDate(),
                        currentTime(),
                        monto,
                        0
                    ]);

                    idCuota++;
                    current = now;
                }
            }

            if (idFormaPago === "FP0003") {

            }

            if (idFormaPago === "FP0004") {

            }

            /**
             * Registrar el proceso de venta y cotzaición
             */

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
                    idUsuario) 
                    VALUES(?,?,?,?,?,?)`, [
                    idVentaCotizacion,
                    idVenta,
                    idCotizacion,
                    currentDate(),
                    currentTime(),
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/create", error);
        }
    }

    async detail(req, res) {
        try {
            // Obtener información general de la venta
            const result = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario,
                DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha,
                v.hora, 
                v.idFormaPago, 
                v.estado, 
                m.simbolo,
                m.codiso,
                m.nombre as moneda,
                v.comentario
            FROM 
                venta AS v 
            INNER JOIN 
                persona AS c ON v.idCliente = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            WHERE 
                v.idVenta = ?`, [
                req.query.idVenta
            ]);

            // Obtener detalles de productos vendidos en la venta
            const detalles = await conec.query(`
            SELECT 
                p.codigo,
                p.nombre AS producto,
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

            // Obtener información de transaccion asociados a la venta
            const transaccion = await conec.query(`
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

            for (const item of transaccion) {
                const transacciones = await conec.query(`
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
                    item.idTransaccion
                ]);

                item.detalles = transacciones;
            }

            // Enviar respuesta exitosa con la información recopilada
            return sendSuccess(res, { "cabecera": result[0], detalles, transaccion });
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
                req.query.idVenta
            ]);

            // Verificar si la venta existe
            if (validate.length === 0) {
                await conec.rollback(connection);
                return sendClient(res, "La venta no existe, verifique el código o actualiza la lista.");
            }

            // Verificar si la venta ya está anulada
            if (validate[0].estado === 3) {
                await conec.rollback(connection);
                return sendClient(res, "La venta ya se encuentra anulada.");
            }

            // Actualizar el estado de la venta a anulado
            await conec.execute(connection, `
                UPDATE 
                    venta 
                SET 
                    estado = 3 
                WHERE 
                    idVenta = ?`, [
                req.query.idVenta
            ]);

            // Actualizar el estado de transacción
            await conec.execute(connection, `
                UPDATE 
                    transaccion 
                SET 
                    estado = 0 
                WHERE 
                    idReferencia = ?`, [
                req.query.idVenta
            ]);

            await conec.execute(connection, `
                UPDATE 
                    cuota 
                SET 
                    estado = 0 
                WHERE 
                    idVenta = ?`, [
                req.query.idVenta
            ]);

            const cuotas = await conec.execute(connection, `
                SELECT
                    idCuota
                FROM
                    cuota
                WHERE
                    idVenta = ?`, [
                req.query.idVenta
            ]);

            for (const cuota of cuotas) {
                await conec.execute(connection, `
                    DELETE FROM 
                        cuotaTransaccion 
                    WHERE 
                        idCuota = ?`, [
                    cuota.idCuota,
                ]);
            }

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
                req.query.idVenta
            ]);

            // Obtener el máximo idKardex existente
            const resultKardex = await conec.execute(connection, `
                SELECT 
                    idKardex 
                FROM 
                    kardex`);
            let idKardex = 0;

            if (resultKardex.length !== 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            for (const detalle of detalleVenta) {
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
                    req.query.idVenta,
                    detalle.idProducto
                ]);

                for (const item of kardex) {
                    // Insertar registro en la tabla kardex para anulación
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
                            hora,
                            fecha,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0001',
                        'MK0004',
                        req.query.idVenta,
                        'ANULACIÓN DE LA VENTA',
                        item.cantidad,
                        item.costo,
                        item.idAlmacen,
                        item.idInventario,
                        currentTime(),
                        currentDate(),
                        req.query.idUsuario
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/cancel", error);
        }
    }

    async filtrar(req, res) {
        try {
            const result = await conec.procedure(`CALL Filtrar_Ventas(?,?)`, [
                req.query.idSucursal,
                req.query.filtrar,
            ])
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/filtrar", error);
        }
    }

    async detailOnly(req, res) {
        try {
            // Obtener detalles de productos vendidos en la venta
            const detalle = await conec.query(`
            SELECT 
                p.codigo,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                vd.idProducto,
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

            // Enviar respuesta exitosa con la información recopilada
            return sendSuccess(res, detalle);
        } catch (error) {
            // Manejar errores y enviar mensaje de error al cliente
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/detailOnly", error);
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

            for (const item of detalles) {
                const producto = await conec.query(`
                SELECT 
                    p.idProducto, 
                    p.codigo,
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
                    item.idProducto,
                ]);

                const newProducto = {
                    ...producto[0],
                    nombreProducto: item.descripcion,
                    precio: item.precio,
                    cantidad: item.cantidad
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la venta, los detalles y las salidas
            return sendSuccess(res, { cliente: cliente[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/detailVenta", error)
        }
    }

    async listAccountsReceivable(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cuenta_Cobrar(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.tipo,
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

            const total = await conec.procedure(`CALL Listar_Cuenta_Cobrar_Count(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.tipo,
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/listAccountReceivable", error);
        }
    }

    async detailAccountsReceivable(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario,
                DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha,
                v.hora, 
                v.idFormaPago, 
                v.numeroCuota,
                v.frecuenciaPago,
                v.estado, 
                m.simbolo,
                m.codiso,
                m.nombre as moneda
            FROM 
                venta AS v 
            INNER JOIN 
                persona AS c ON v.idCliente = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            WHERE 
                v.idVenta = ?`, [
                req.query.idVenta
            ]);

            const detalles = await conec.query(`
            SELECT 
                p.nombre AS producto,
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

            const resumen = await conec.query(`
            SELECT 
                SUM(cd.cantidad * cd.precio) AS total,
                (
                    SELECT 
                        IFNULL(SUM(td.monto), 0)
                    FROM 
                        transaccion AS t
                    INNER JOIN 
                        transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                    WHERE 
                        t.idReferencia = c.idVenta AND t.estado = 1
                ) AS cobrado
            FROM 
                venta AS c 
            INNER JOIN 
                ventaDetalle AS cd ON cd.idVenta = c.idVenta
            WHERE 
                c.idVenta = ?`, [
                req.query.idVenta
            ]);

            const cuotas = await conec.query(`
            SELECT 
                idCuota,
                cuota,
                DATE_FORMAT(fecha, '%d/%m/%Y') AS fecha,
                monto,
                estado
            FROM 
                cuota 
            WHERE 
                idVenta = ?`, [
                req.query.idVenta
            ]);

            for (const cuota of cuotas) {
                const transacciones = await conec.query(`
                    SELECT 
                        t.idTransaccion,
                        DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha,
                        t.hora,
                        c.nombre AS concepto,
                        t.nota,
                        CONCAT(us.nombres,' ',us.apellidos) AS usuario
                    FROM 
                        cuota AS p
                    INNER JOIN 
                        cuotaTransaccion AS pi ON pi.idCuota = p.idCuota
                    INNER JOIN 
                        transaccion AS t ON t.idTransaccion = pi.idTransaccion
                    INNER JOIN
                        concepto c ON c.idConcepto = t.idConcepto
                    INNER JOIN 
                        usuario AS us ON us.idUsuario = t.idUsuario
                    WHERE 
                        t.estado = 1 AND p.idCuota = ?`, [
                    cuota.idCuota
                ]);

                for (const item of transacciones) {
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
                        item.idTransaccion
                    ]);

                    item.detalles = detalles;
                }

                cuota.transacciones = transacciones;
            }

            return sendSuccess(res, { "cabecera": result[0], detalles, resumen, cuotas });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/detailAccountReceivable", error);
        }
    }

    async createAccountsReceivable(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idVenta,
                idCuota,
                idUsuario,
                monto,
                notaTransacion,
                bancosAgregados,
            } = req.body;

            const cuota = await conec.execute(connection, `SELECT monto FROM cuota WHERE idCuota = ?`, [
                idCuota
            ]);

            const cuotaTransaccion = await conec.execute(connection, `
            SELECT 
                SUM(td.monto) AS monto
            FROM 
                cuotaTransaccion AS ct
            INNER JOIN 
                cuota as cu ON cu.idCuota = ct.idCuota
            INNER JOIN 
                transaccion as tn ON tn.idTransaccion = ct.idTransaccion
            INNER JOIN
                transaccionDetalle AS td ON td.idTransaccion = tn.idTransaccion
            WHERE 
                ct.idCuota = ? AND tn.estado = 1`, [
                idCuota
            ]);

            const cuotaMonto = cuota[0].monto;

            const cuotaEchas = cuotaTransaccion.reduce((accumulator, item) => accumulator + item.monto, 0)

            if (monto + cuotaEchas >= cuotaMonto) {
                await conec.execute(connection, `
                UPDATE 
                    cuota
                SET 
                    estado = 1
                WHERE 
                    idCuota = ?`, [
                    idCuota
                ]);
            }

            const transacciones = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    transaccion AS t
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = t.idTransaccion
                WHERE 
                    t.idReferencia = ? AND t.estado = 1`, [
                idVenta
            ]);

            const sumaTransacciones = transacciones.reduce((accumulator, item) => accumulator + item.monto, 0);

            const venta = await conec.query(`
            SELECT 
                SUM(cd.cantidad * cd.precio) AS total
            FROM 
                venta AS c 
            INNER JOIN 
                ventaDetalle AS cd ON cd.idVenta = c.idVenta
            WHERE 
                c.idVenta = ?`, [
                idVenta
            ]);

            if (sumaTransacciones + monto >= venta[0].total) {
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

            const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
            let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

            await conec.execute(connection, `
                INSERT INTO transaccion(
                    idTransaccion,
                    idConcepto,
                    idReferencia,
                    nota,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                'CP0003',
                idVenta,
                notaTransacion,
                1,
                currentDate(),
                currentTime(),
                idUsuario
            ]);

            await conec.execute(connection, `
                INSERT INTO cuotaTransaccion(
                    idCuota,
                    idTransaccion
                ) VALUES(?,?)`, [
                idCuota,
                idTransaccion
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

            const validate = await conec.execute(connection, `
                SELECT * FROM 
                    cuotaTransaccion 
                WHERE 
                    idCuota = ? AND idTransaccion = ?`, [
                req.query.idCuota,
                req.query.idTransaccion,
            ]);

            if (validate.length === 0) {
                // Si no existe, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return sendClient(res, "El cobro no existe, actualize su vista.");
            }

            const cuota = await conec.execute(connection, `SELECT monto FROM cuota WHERE idCuota = ?`, [
                req.query.idCuota,
            ]);

            const cuotaTransaccion = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    cuotaTransaccion AS ct
                INNER JOIN 
                    cuota as cu ON cu.idCuota = ct.idCuota
                INNER JOIN 
                    transaccion as tn ON tn.idTransaccion = ct.idTransaccion
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = tn.idTransaccion
                WHERE 
                    ct.idCuota = ? AND tn.estado = 1`, [
                req.query.idCuota,
            ]);

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

            const cuotaMonto = cuota[0].monto;

            const cuotaEchos = cuotaTransaccion.reduce((accumulator, item) => accumulator + item.monto, 0);

            const monto = transaccion[0].monto;

            if (cuotaEchos - monto < cuotaMonto) {
                await conec.execute(connection, `
                    UPDATE 
                        cuota 
                    SET 
                        estado = 0 
                    WHERE 
                        idCuota = ?`, [
                    req.query.idCuota
                ]);
            }

            await conec.execute(connection, `
                DELETE FROM 
                    cuotaTransaccion 
                WHERE 
                    idCuota = ? AND idTransaccion = ?`, [
                req.query.idCuota,
                req.query.idTransaccion,
            ]);

            await conec.execute(connection, `
                UPDATE 
                    transaccion 
                SET 
                    estado = 0 
                WHERE 
                    idTransaccion = ?`, [
                req.query.idTransaccion
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
                    venta AS c 
                INNER JOIN 
                    ventaDetalle AS cd ON cd.idVenta = c.idVentac 
                WHERE 
                    c.idVenta = ?`, [
                req.query.idVenta
            ]);

            if (sumaTransacciones - monto < venta[0].total) {
                await conec.execute(connection, `
                UPDATE 
                    venta
                SET 
                    estado = 2
                WHERE 
                    idVenta = ?`, [
                    req.query.idVenta
                ]);
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se anuló correctamente su cobro.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/createAccountsPayable", error);
        }
    }

}

module.exports = new Factura();