const { currentDate, currentTime, frecuenciaPago, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendClient, sendSave } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Factura {

    async list(req, res) {
        try {
            console.log(req.query)
            const lista = await conec.procedure(`CALL Listar_Ventas(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Ventas_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
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
                tipo,
                estado,
                comentario,
                nuevoCliente,
                detalleVenta,
                metodoPagoAgregado

            } = req.body;
            /**
             * Validación de productos inventariables
             */

            let validarInventario = 0;
            let mensajeInventario = [];

            for (const item of detalleVenta) {
                if (item.tipo === "PRODUCTO") {
                    const inventario = await conec.execute(connection, `SELECT i.cantidad, p.negativo 
                    FROM inventario AS i
                    INNER JOIN almacen AS a ON a.idAlmacen = i.idAlmacen
                    INNER JOIN producto AS p ON p.idProducto = i.idProducto
                    where a.predefinido = 1 AND p.idProducto = ?`, [
                        item.idProducto,
                    ]);

                    if (inventario[0].negativo === 0) {
                        const cantidadActual = item.cantidad;
                        const cantidadReal = inventario[0].cantidad;


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

            if (validarInventario > 0) {
                await conec.rollback(connection);
                return sendClient(res, { "message": "error de 0", body: mensajeInventario });
            }

            /**
             * Validar si el cliente existe
             */


            if (nuevoCliente) {
                const cliente = await conec.execute(connection, `SELECT * FROM clienteNatural WHERE documento = ?`, [
                    nuevoCliente.numeroDocumento
                ])

                if (cliente.length === 0) {
                    const result = await conec.execute(connection, 'SELECT idCliente FROM clienteNatural');
                    idCliente = generateAlphanumericCode("CN0001", result, 'idCliente');

                    await conec.execute(connection, `INSERT INTO clienteNatural(
                        idCliente,
                        idTipoCliente,
                        idTipoDocumento,
                        documento,
                        informacion,
                        celular,
                        direccion,
                        predeterminado,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        idCliente,
                        nuevoCliente.idTipoCliente,
                        nuevoCliente.idTipoDocumento,
                        nuevoCliente.numeroDocumento,
                        nuevoCliente.informacion,
                        nuevoCliente.numeroCelular,
                        nuevoCliente.direccion,
                        false,
                        true,
                        currentDate(),
                        currentTime(),
                        idUsuario
                    ])
                }
            }

            /**
             * Generar un código unico para la venta. 
             */
            const result = await conec.execute(connection, 'SELECT idVenta FROM venta');
            const idVenta = generateAlphanumericCode("VT0001", result, 'idVenta');

            /**
             * Obtener la serie y numeración del comprobante.
             */
            const comprobante = await conec.execute(connection, `SELECT 
                serie,
                numeracion 
                FROM comprobante 
                WHERE idComprobante  = ?
                `, [
                idComprobante
            ]);

            const ventas = await conec.execute(connection, `SELECT 
                numeracion  
                FROM venta 
                WHERE idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, ventas, "numeracion");

            /**
             * Proceso para ingresar una venta.
             */

            await conec.execute(connection, `INSERT INTO venta(
                idVenta,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,                
                tipo,
                comentario,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idVenta,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                comprobante[0].serie,
                numeracion,
                tipo,
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
                let cantidad = 0;
                let precio = 0;

                if (item.tipo === "PRODUCTO") {
                    const inventario = await conec.execute(connection, `SELECT idAlmacen FROM inventario WHERE idInventario = ?`, [
                        item.idInventario
                    ]);

                    const producto = await conec.execute(connection, `SELECT 
                    p.costo, 
                    pc.valor AS precio 
                    FROM producto AS p 
                    INNER JOIN precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                    WHERE p.idProducto = ?`, [
                        item.idProducto,
                    ]);

                    if (item.idTipoVenta === 'TV0001' || item.idTipoVenta === 'TV0004' || item.idTipoVenta === 'TV0003') {
                        precio = item.precio;
                        cantidad = item.cantidad;
                    }

                    if (item.idTipoVenta === 'TV0002') {
                        precio = producto[0].precio;
                        cantidad = item.precio / producto[0].precio;
                    }

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
                        'MK0003',
                        'SALIDA DEL PRODUCTO POR VENTA',
                        cantidad,
                        producto[0].costo,
                        inventario[0].idAlmacen,
                        currentTime(),
                        currentDate(),
                        idUsuario
                    ]);

                    await conec.execute(connection, `UPDATE inventario SET
                    cantidad = cantidad - ? 
                    WHERE idInventario = ?`, [
                        cantidad,
                        item.idInventario
                    ]);
                }

                await conec.execute(connection, `INSERT INTO ventaDetalle(
                    idVentaDetalle,
                    idVenta,
                    idProducto,
                    idInventario,
                    descripcion,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?,?)`, [
                    idVentaDetalle,
                    idVenta,
                    item.idProducto,
                    item.idInventario,
                    item.nombreProducto,
                    precio,
                    cantidad,
                    item.idImpuesto
                ])

                idVentaDetalle++;
            }

            /**
             * Proceso para ingresa la lista de ingresos con sus método de pagos
             */

            // Generar el Id único
            const listaIngresosId = await conec.execute(connection, 'SELECT idIngreso FROM ingreso');
            let idIngreso = generateNumericCode(1, listaIngresosId, 'idIngreso');

            // Proceso de registro  
            for (const item of metodoPagoAgregado) {
                await conec.execute(connection, `INSERT INTO ingreso(
                    idIngreso,
                    idVenta,
                    idCobro,
                    idMetodoPago,
                    monto,
                    descripcion,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                    idIngreso,
                    idVenta,
                    null,
                    item.idMetodoPago,
                    item.monto,
                    item.descripcion,
                    1,
                    currentDate(),
                    currentTime(),
                    idUsuario
                ])

                idIngreso++;
            }

            /**
             * Proceso de registrar datos en la tabla auditoria para tener un control de los movimientos echos.
             */

            // Generar el Id único
            const listAuditoria = await conec.execute(connection, 'SELECT idAuditoria FROM auditoria');
            const idAuditoria = generateNumericCode(1, listAuditoria, 'idAuditoria');

            // Proceso de registro            
            await conec.execute(connection, `INSERT INTO auditoria(
                idAuditoria,
                idProcedencia,
                descripcion,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?)`, [
                idAuditoria,
                idVenta,
                `REGISTRO DEL COMPROBANTE ${comprobante[0].serie}-${numeracion}`,
                currentDate(),
                currentTime(),
                idUsuario
            ]);

            await conec.commit(connection);
            return sendSave(res, {
                message: "Se completo el proceso correctamente.",
                idVenta: idVenta
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
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
                v.tipo, 
                v.estado, 
                m.simbolo,
                m.codiso,
                m.nombre as moneda
            FROM venta AS v 
                INNER JOIN clienteNatural AS c ON v.idCliente = c.idCliente
                INNER JOIN usuario AS us ON us.idUsuario = v.idUsuario 
                INNER JOIN tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
                INNER JOIN comprobante AS com ON v.idComprobante = com.idComprobante
                INNER JOIN moneda AS m ON m.idMoneda = v.idMoneda
            WHERE v.idVenta = ?
        `, [req.query.idVenta]);

            // Obtener detalles de productos vendidos en la venta
            const detalle = await conec.query(`
            SELECT 
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                vd.precio,
                vd.cantidad,
                vd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM ventaDetalle AS vd 
                INNER JOIN producto AS p ON vd.idProducto = p.idProducto 
                INNER JOIN medida AS md ON md.idMedida = p.idMedida 
                INNER JOIN categoria AS m ON p.idCategoria = m.idCategoria 
                INNER JOIN impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE vd.idVenta = ?
        `, [req.query.idVenta]);

            // Obtener información de ingresos asociados a la venta
            const ingresos = await conec.query(`
            SELECT 
                mp.nombre,
                i.descripcion,
                i.monto,
                DATE_FORMAT(i.fecha,'%d/%m/%Y') as fecha,
                i.hora
            FROM ingreso as i 
                INNER JOIN venta as v  ON i.idVenta = v.idVenta
                INNER JOIN metodoPago as mp on i.idMetodoPago = mp.idMetodoPago               
            WHERE v.idVenta = ?
        `, [req.query.idVenta]);

            // Enviar respuesta exitosa con la información recopilada
            return sendSuccess(res, { "cabecera": result[0], detalle, ingresos });
        } catch (error) {
            // Manejar errores y enviar mensaje de error al cliente
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async cancel(req, res) {
        let connection = null;

        try {
            // Iniciar una transacción
            connection = await conec.beginTransaction();

            // Obtener información de la venta para el id proporcionado
            const venta = await conec.execute(connection, `SELECT 
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
            if (venta.length === 0) {
                await conec.rollback(connection);
                return sendError(res, "La venta no existe, verifique el código o actualiza la lista.");
            }

            // Verificar si la venta ya está anulada
            if (venta[0].estado === 3) {
                await conec.rollback(connection);
                return sendError(res, "La venta ya se encuentra anulada.");
            }

            // Actualizar el estado de la venta a anulado
            await conec.execute(connection, `UPDATE venta 
            SET 
                estado = 3 
            WHERE 
                idVenta = ?`, [
                req.query.idVenta
            ]);

            // Actualizar el estado de los ingresos asociados a la venta
            await conec.execute(connection, `UPDATE ingreso 
            SET 
                estado = 0 
            WHERE 
                idVenta = ?`, [
                req.query.idVenta
            ]);

            // Obtener detalles de la venta
            const detalleVenta = await conec.execute(connection, `SELECT 
                idProducto, 
                idInventario, 
                precio, 
                cantidad 
            FROM 
                ventaDetalle 
            WHERE 
                idVenta = ?`, [
                req.query.idVenta
            ]);

            // Obtener el máximo idKardex existente
            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length !== 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Iterar sobre los detalles de la venta y realizar operaciones de anulación
            for (const item of detalleVenta) {
                // Obtener el costo del producto
                const producto = await conec.execute(connection, `
                SELECT costo FROM producto WHERE idProducto = ?
            `, [item.idProducto]);

                // Obtener el idAlmacen del inventario
                const inventario = await conec.execute(connection, `
                SELECT idAlmacen FROM inventario WHERE idInventario = ?
            `, [item.idInventario]);

                // Insertar registro en la tabla kardex para anulación
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
                    'MK0004',
                    'ANULACIÓN DE LA VENTA',
                    item.cantidad,
                    producto[0].costo,
                    inventario[0].idAlmacen,
                    currentTime(),
                    currentDate(),
                    req.query.idUsuario
                ]);

                // Actualizar la cantidad en el inventario
                await conec.execute(connection, `UPDATE inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    item.cantidad,
                    item.idInventario
                ]);
            }

            // Obtener el máximo idAuditoria existente
            const listAuditoria = await conec.execute(connection, 'SELECT idAuditoria FROM auditoria');
            const idAuditoria = generateNumericCode(1, listAuditoria, 'idAuditoria');

            // Insertar registro en la tabla auditoria para anulación de la venta
            await conec.execute(connection, `INSERT INTO auditoria(
                idAuditoria,
                idProcedencia,
                descripcion,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?)`, [
                idAuditoria,
                req.query.idVenta,
                `ANULACIÓN DEL COMPROBANTE ${venta[0].serie}-${venta[0].numeracion}`,
                currentDate(),
                currentTime(),
                req.query.idUsuario
            ]);

            // Confirmar la transacción
            await conec.commit(connection);

            // Enviar respuesta exitosa
            return sendSave(res, "Se anuló correctamente la venta.");
        } catch (error) {
            // Manejar errores y realizar rollback en caso de problemas
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async accountsReceivable(req, res) {
        try {
            console.log("sss")
            console.log(req.query)
            const lista = await conec.procedure(`CALL Listar_Cuenta_Cobrar(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Cuenta_Cobrar_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            console.log(error)
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async cpesunat(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_CpeSunat(?,?,?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idComprobante,
                parseInt(req.query.idEstado),
                req.query.fill,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_CpeSunat_Count(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idComprobante,
                parseInt(req.query.idEstado),
                req.query.fill,
            ]);

            const resultTotal = await total.map(item => item.Total).reduce((previousValue, currentValue) => previousValue + currentValue, 0);

            return sendSuccess(res, { "result": resultLista, "total": resultTotal });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async idReport(req) {
        try {

            const result = await conec.query(`SELECT
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
    
            DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha,
            v.hora, 
            v.tipo, 
            v.estado, 
            m.simbolo,
            m.codiso,
            m.nombre as moneda,

            IFNULL(SUM(vd.precio*vd.cantidad),0) AS monto
            FROM venta AS v 
            INNER JOIN clienteNatural AS c ON v.idCliente = c.idCliente
            INNER JOIN tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN moneda AS m ON m.idMoneda = v.idMoneda
            LEFT JOIN ventaDetalle AS vd ON vd.idVenta = v.idVenta 
            WHERE v.idVenta = ?
            GROUP BY v.idVenta`, [
                req.query.idVenta
            ]);

            if (result.length > 0) {

                const detalle = await conec.query(`SELECT 
                p.nombre AS producto,
                md.codigo AS medida, 
                m.nombre AS categoria,                 
                vd.precio,  
                vd.cantidad,                
                imp.idImpuesto,
                imp.nombre as impuesto,                
                imp.porcentaje
                FROM ventaDetalle AS vd 
                INNER JOIN producto AS p ON vd.idProducto = p.idProducto 
                INNER JOIN medida AS md ON md.idMedida = p.idMedida 
                INNER JOIN categoria AS m ON p.idCategoria = m.idCategoria                
                INNER JOIN impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto 
                WHERE vd.idVenta = ? `, [
                    req.query.idVenta
                ]);

                return { "cabecera": result[0], "detalle": detalle };
            } else {
                return "Datos no encontrados";
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detalleCredito(req, res) {
        try {
            const venta = await conec.query(`
            SELECT 
            v.idVenta, 
            cl.idCliente,
            cl.documento, 
            cl.informacion, 
            cl.celular,
            cl.telefono,
            cl.email,
            cl.direccion,        
            cm.nombre, 
            v.serie, 
            v.numeracion, 
            v.numCuota, 
            (SELECT IFNULL(MIN(fecha),'') FROM plazo WHERE estado = 0) AS fechaPago,
            DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha, 
            v.hora, 
            v.estado,
            v.credito,
            v.frecuencia,
            m.idMoneda,
            m.codiso,
            IFNULL(SUM(vd.precio*vd.cantidad),0) AS total,
            (
                SELECT IFNULL(SUM(cv.precio),0) 
                FROM cobro AS c 
                LEFT JOIN notaCredito AS nc ON c.idCobro = nc.idCobro AND nc.estado = 1
                LEFT JOIN cobroVenta AS cv ON c.idCobro = cv.idCobro 
                WHERE c.idProcedencia = v.idVenta AND c.estado = 1 AND nc.idNotaCredito IS NULL
            ) AS cobrado 
            FROM venta AS v 
            INNER JOIN moneda AS m ON m.idMoneda = v.idMoneda
            INNER JOIN comprobante AS cm ON v.idComprobante = cm.idComprobante 
            INNER JOIN clienteNatural AS cl ON v.idCliente = cl.idCliente 
            LEFT JOIN ventaDetalle AS vd ON vd.idVenta = v.idVenta 
            WHERE  
            v.idVenta = ?
            GROUP BY v.idVenta
            `, [
                req.query.idVenta
            ]);

            const detalle = await conec.query(`SELECT 
            l.idProducto,
            l.descripcion AS producto,
            md.idMedida,
            md.codigo AS medida, 
            m.nombre AS categoria, 
            p.nombre AS sucursal,
            vd.precio,
            vd.cantidad,
            vd.idImpuesto,
            imp.nombre as impuesto,
            imp.porcentaje
            FROM ventaDetalle AS vd 
            INNER JOIN producto AS l ON vd.idProducto = l.idProducto 
            INNER JOIN medida AS md ON md.idMedida = l.idMedida 
            INNER JOIN categoria AS m ON l.idCategoria = m.idCategoria 
            INNER JOIN sucursal AS p ON m.idSucursal = p.idSucursal
            INNER JOIN impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto 
            WHERE vd.idVenta = ? `, [
                req.query.idVenta
            ]);

            const plazos = await conec.query(`SELECT 
            idPlazo,      
            cuota,  
            DATE_FORMAT(fecha,'%d/%m/%Y') as fecha,
            monto,
            estado
            FROM plazo WHERE idVenta = ?
            `, [
                req.query.idVenta
            ]);

            const cobros = await conec.query(`SELECT c.idCobro 
            FROM cobro AS c 
            LEFT JOIN notaCredito AS nc ON nc.idCobro = c.idCobro AND nc.estado = 1
            WHERE c.idProcedencia = ? AND c.estado = 1 AND nc.idNotaCredito IS NULL`, [
                req.query.idVenta
            ]);

            let newPlazos = [];

            for (const item of plazos) {

                let newCobros = [];
                for (const cobro of cobros) {

                    const cobroPlazo = await conec.query(`SELECT 
                    cv.idPlazo,
                    cp.nombre,
                    c.serie,
                    c.numeracion,
                    DATE_FORMAT(c.fecha,'%d/%m/%Y') as fecha, 
                    c.hora,
                    c.observacion,
                    bc.nombre as banco,
                    mo.codiso,
                    cv.precio
                    FROM cobro AS c 
                    INNER JOIN banco AS bc ON bc.idBanco = c.idBanco
                    INNER JOIN moneda AS mo ON mo.idMoneda = c.idMoneda
                    INNER JOIN comprobante AS cp ON cp.idComprobante = c.idComprobante
                    INNER JOIN cobroVenta AS cv ON cv.idCobro = c.idCobro
                    WHERE cv.idPlazo = ? AND cv.idVenta = ? AND c.idCobro = ?`, [
                        parseInt(item.idPlazo),
                        req.query.idVenta,
                        cobro.idCobro
                    ]);

                    if (cobroPlazo.length > 0) {
                        newCobros.push(cobroPlazo[0]);
                    }
                }
                newPlazos.push({
                    ...item,
                    "cobros": newCobros
                });
            }

            const inicial = await conec.query(`
            SELECT  
            co.nombre AS comprobante,
            c.serie,
            c.numeracion,
            bn.nombre AS banco,
            DATE_FORMAT(c.fecha,'%d/%m/%Y') as fecha, 
            c.hora,
            c.observacion,
            mo.codiso,
            sum(cv.precio) AS monto
            FROM cobro AS c          
            INNER JOIN banco AS bn ON bn.idBanco = c.idBanco
            INNER JOIN moneda AS mo ON mo.idMoneda = c.idMoneda
            INNER JOIN comprobante AS co ON co.idComprobante = c.idComprobante
            INNER JOIN cobroVenta AS cv ON c.idCobro = cv.idCobro AND cv.idPlazo = 0
            WHERE c.idProcedencia = ?
            GROUP BY c.idCobro`, [
                req.query.idVenta
            ]);

            return sendSuccess(res, {
                "venta": venta[0],
                "detalle": detalle,
                "plazos": newPlazos,
                "inicial": inicial
            });

        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async detalleVenta(req) {
        try {
            let ventas = await conec.procedure(`CALL Detalle_Ventas(?,?,?,?,?,?)`, [
                req.query.fechaIni,
                req.query.fechaFin,

                req.query.idComprobante,
                req.query.idCliente,
                req.query.idUsuario,
                req.query.tipoVenta,
            ]);

            return ventas;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = new Factura();