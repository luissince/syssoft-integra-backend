const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, } = require('../tools/Tools');
const { PRODUCT_TREATMENTS, PRODUCT_TREATMENTS_DIRECT, KARDEX_TYPES, KARDEX_MOTIVOS } = require('../config/constants');
const { sendSave, sendError, sendSuccess, sendClient, sendFile } = require('../tools/Message');
const axios = require('axios').default;
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');

class Compra {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Compras(?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Compras_Count(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            // Inicia la transacción
            connection = await conec.beginTransaction();

            // Obtener la fecha y hora actual
            const date = currentDate();
            const time = currentTime();

            // Extrae los datos del cuerpo de la solicitud
            const {
                idComprobante,
                idProveedor,
                idUsuario,
                idSucursal,
                idAlmacen,
                idMoneda,
                idOrdenCompra,
                observacion,
                nota,
                estado,
                detalles,

                idFormaPago,
                bancosAgregados,
                idPlazo,
                notaTransacion
            } = req.body;

            // Verifica si se ha proporcionado una orden de compra
            if (idOrdenCompra) {
                // Obtener las ordenes de compra ya existentes
                const comprados = await conec.query(`
                    SELECT 
                        p.idProducto,
                        SUM(vd.cantidad) AS cantidad
                    FROM 
                        compraOrdenCompra AS vc
                    INNER JOIN
                        compra AS v ON v.idCompra = vc.idCompra AND v.estado <> 3
                    INNER JOIN
                        compraDetalle AS vd ON vd.idCompra = v.idCompra
                    INNER JOIN
                        producto AS p ON p.idProducto = vd.idProducto
                    WHERE 
                        vc.idOrdenCompra = ?
                    GROUP BY 
                        p.idProducto`, [idOrdenCompra]);

                // Obtener los detalles de la orden de compra
                const ordenCompraDetalles = await conec.query(`
                    SELECT 
                        cd.idProducto,
                        cd.costo,
                        cd.cantidad
                    FROM
                        ordenCompraDetalle AS cd
                    WHERE
                        cd.idOrdenCompra = ?`, [idOrdenCompra]);

                // Verificar si hay algún producto que no se encuentre en la orden de compra
                const newDetallesOrdenCompra = ordenCompraDetalles.map((detalle) => {
                    const item = comprados.find(pro => pro.idProducto === detalle.idProducto);
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

                const newDetallesCompra = [];
                for (const item of detalles) {
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
                                cantidad = inventario.cantidad;
                            } else if (item.idTipoTratamientoProducto === PRODUCT_TREATMENTS.VALOR_MONETARIO) {
                                cantidad = item.precio / producto[0].precio;
                            }

                            return sum + cantidad;
                        }, 0);

                        newDetallesCompra.push({
                            idProducto: item.idProducto,
                            cantidad
                        });
                    } else if (item.tipo === "SERVICIO") {
                        newDetallesCompra.push({
                            idProducto: item.idProducto,
                            cantidad: item.cantidad
                        });
                    }
                }

                // 1️ Validación de cantidad de ítems
                if (newDetallesCompra.length > newDetallesOrdenCompra.length) {
                    await conec.rollback(connection);
                    return sendClient(res, { "message": "El número de productos en la orden de compra no coincide con los productos comprados." });
                }

                // 2 Validación de ids
                const ids1 = new Set(newDetallesOrdenCompra.map(obj => obj.idProducto));
                const ids2 = new Set(newDetallesCompra.map(obj => obj.idProducto));

                for (let id of ids2) {
                    if (!ids1.has(id)) {
                        await conec.rollback(connection);
                        return sendClient(res, { "message": "Los productos comprados no son iguales al de la orden de compra." });
                    }
                }

                // 3 Validación de cantidad de productos
                const map1 = new Map(newDetallesOrdenCompra.map(obj => [obj.idProducto, obj.cantidad]));
                const map2 = new Map(newDetallesCompra.map(obj => [obj.idProducto, obj.cantidad]));

                const diferencias = [];
                for (let [idProducto, cantidad] of map1) {
                    if (map2.has(idProducto)) {
                        if (map2.get(idProducto) > cantidad) {
                            diferencias.push(true);
                        }
                    }
                }

                if (diferencias.length > 0) {
                    await conec.rollback(connection);
                    return sendClient(res, { "message": "Algunos productos tienen una cantidad diferente a la orden de compra." });
                }
            }

            // Genera un nuevo ID para la compra
            const listCompras = await conec.execute(connection, `SELECT idCompra FROM compra`);
            const idCompra = generateAlphanumericCode("CP0001", listCompras, 'idCompra');

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

            // Consulta numeraciones de compras asociadas al mismo comprobante
            const compras = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                compra 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            // Genera una nueva numeración para la compra
            const numeracion = generateNumericCode(comprobante[0].numeracion, compras, "numeracion");

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
            // Inserta la información principal de la compra en la base de datos
            await conec.execute(connection, `
            INSERT INTO compra(
                idCompra,
                idProveedor,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                idAlmacen,
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
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idCompra,
                idProveedor,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                idAlmacen,
                comprobante[0].serie,
                numeracion,
                idFormaPago,
                idPlazo,
                fechaVencimiento,
                observacion,
                nota,
                estado,
                date,
                time,
            ]);

            // Genera un nuevo ID para los detalles de compra
            const listaIdCompraDetalle = await conec.execute(connection, `SELECT idCompraDetalle FROM compraDetalle`);
            let idCompraDetalle = generateNumericCode(1, listaIdCompraDetalle, 'idCompraDetalle');

            // Consulta el último ID de Kardex
            const kardexIds = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Inserta los detalles de compra en la base de datos
            for (const item of detalles) {
                const producto = await conec.execute(connection, `
                    SELECT 
                        idTipoProducto,
                        idMetodoDepreciacion
                    FROM 
                        producto
                    WHERE 
                        idProducto = ?`, [
                    item.idProducto,
                ]);

                // const cantidad = item.inventarioDetalles.reduce((acumulador, inventarioDetalle) => acumulador + Number(inventarioDetalle.cantidad.value), 0);
                const cantidad = item.inventarioDetalles.reduce(
                    (acc, d) => acc + Number(d.cantidad || 0),
                    0
                );

                // Insertar en la compra detalle
                await await conec.execute(connection, `
                INSERT INTO compraDetalle(
                    idCompraDetalle,
                    idCompra,
                    idProducto,
                    costo,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?)`, [
                    idCompraDetalle,
                    idCompra,
                    item.idProducto,
                    item.costo,
                    cantidad,
                    item.idImpuesto
                ]);

                idCompraDetalle++;

                // Calcular es costo actual en base a la formula de costo promedio ponderado
                const valorTotalInventarioInicial = await conec.execute(connection, `
                SELECT 
                    IFNULL(
                        SUM(
                            CASE 
                                WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad
                                ELSE -k.cantidad
                            END
                        ),0
                    ) AS cantidad,

                    IFNULL(
                        SUM(
                            CASE 
                                WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad * p.costo
                                ELSE -k.cantidad * p.costo
                            END
                        ),0
                    ) AS total
                FROM 
                    kardex AS k
                INNER JOIN 
                    producto AS p ON p.idProducto = k.idProducto
                WHERE 
                        k.idProducto = ?
                    AND 
                        k.idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacen
                ]);

                let costo = 0;

                if (valorTotalInventarioInicial.length !== 0 && valorTotalInventarioInicial[0].total !== 0) {
                    const valorTotalNuevaCompra = item.costo * cantidad;
                    const sumaTotales = valorTotalInventarioInicial[0].total + valorTotalNuevaCompra;
                    const sumaCantidades = cantidad + valorTotalInventarioInicial[0].cantidad;
                    const costoPromedio = sumaTotales / sumaCantidades;
                    costo = costoPromedio;
                } else {
                    costo = item.costo;
                }

                for (const inventarioDetalle of item.inventarioDetalles) {
                    // Inserta información en el Kardex con ID del lote
                    await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idCompra,
                            detalle,
                            cantidad,
                            costo,
                            idAlmacen,
                            lote,
                            idUbicacion,
                            fechaVencimiento,
                            serie,
                            vidaUtil,
                            valorResidual,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        generarIdKardex(),
                        item.idProducto,
                        KARDEX_TYPES.INGRESO,
                        KARDEX_MOTIVOS.AJUSTE,
                        idCompra,
                        `INGRESO POR COMPRA`,
                        Number(inventarioDetalle.cantidad),
                        item.costo,
                        idAlmacen,
                        inventarioDetalle.lote || null,
                        inventarioDetalle.idUbicacion || null,
                        inventarioDetalle.fechaVencimiento || null,
                        inventarioDetalle.serie || null,
                        inventarioDetalle.vidaUtil || null,
                        inventarioDetalle.valorResidual || null,
                        date,
                        time,
                        idUsuario
                    ]);
                }

                // Actualizar el costo del producto
                if (costo > 0) {
                    await conec.execute(connection, `
                        UPDATE 
                            producto 
                        SET 
                            costo = ?
                        WHERE 
                            idProducto = ?`, [
                        costo,
                        item.idProducto
                    ]);
                }
            }

            // Si el tipo de compra es contado
            if (idFormaPago === 'FP0001') {
                const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
                const idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

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
                    'CP0002',
                    idCompra,
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

            // Si la compra está asociada a una orden de compra
            if (idOrdenCompra) {
                const listaIdCompraOrdenCompra = await conec.execute(connection, 'SELECT idCompraOrdenCompra FROM compraOrdenCompra');
                const idCompraOrdenCompra = generateNumericCode(1, listaIdCompraOrdenCompra, 'idCompraOrdenCompra');

                await conec.execute(connection, `
                    INSERT INTO compraOrdenCompra(
                        idCompraOrdenCompra, 
                        idCompra, 
                        idOrdenCompra, 
                        fecha, 
                        hora,
                        idUsuario
                    ) VALUES (?,?,?,?,?,?)`, [
                    idCompraOrdenCompra,
                    idCompra,
                    idOrdenCompra,
                    date,
                    time,
                    idUsuario
                ]);
            }

            // Confirma la transacción
            await conec.commit(connection);
            return sendSave(res, {
                idCompra: idCompra,
                message: "Se registró correctamente la compra."
            });
        } catch (error) {
            // En caso de error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/create", error);
        }
    }

    async detail(req, res) {
        try {
            const { idCompra } = req.query;

            // Consulta la información principal de la compra
            const compra = await conec.query(`
            SELECT 
                DATE_FORMAT(c.fecha, '%d/%m/%Y') AS fecha, 
                c.hora,
                co.nombre AS comprobante,
                c.serie,
                c.numeracion,
                td.nombre AS tipoDocumento, 
                cn.documento,
                cn.informacion,
                cn.telefono,
                cn.celular,
                cn.email,
                cn.direccion,                
                al.nombre AS almacen,
                fc.idFormaPago,
                c.estado,
                c.observacion,
                c.nota,
                mo.codiso,
                pu.informacion AS usuario
            FROM 
                compra AS c
            INNER JOIN 
                comprobante AS co ON co.idComprobante = c.idComprobante
            INNER JOIN 
                formaPago AS fc ON fc.idFormaPago = c.idFormaPago
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = c.idMoneda
            INNER JOIN 
                almacen AS al ON al.idAlmacen = c.idAlmacen
            INNER JOIN 
                persona AS cn ON cn.idPersona = c.idProveedor
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = cn.idTipoDocumento 
            INNER JOIN 
                usuario AS us ON us.idUsuario = c.idUsuario
            INNER JOIN
                persona AS pu ON pu.idPersona = us.idPersona
            WHERE 
                c.idCompra = ?`, [
                idCompra,
            ]);

            // Consulta los detalles de la compra
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCompraDetalle ASC) AS id,
                p.idProducto,
                p.idTipoProducto,
                c.idAlmacen,
                p.imagen,
                p.codigo,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                cd.costo,
                cd.cantidad,
                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                compraDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                compra AS c ON c.idCompra = cd.idCompra
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto  
            WHERE 
                cd.idCompra = ?
            ORDER BY 
                cd.idCompraDetalle ASC`, [
                idCompra,
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                }
            });

            for (const item of listaDetalles) {
                // Buscar el ID de inventario
                const inventarioDetalles = await conec.query(`
                SELECT 
                    k.lote,
                    k.serie,
                    k.cantidad,
                    k.vidaUtil,
                    k.valorResidual,
                    k.cantidad,
                    CASE 
                        WHEN 
                            k.fechaVencimiento IS NULL THEN NULL
                        ELSE 
                            DATE_FORMAT(k.fechaVencimiento, '%d/%m/%Y')
                    END AS fechaVencimiento,
                    iu.descripcion AS ubicacion,
                    k.costo
                FROM 
                    kardex AS k
                LEFT JOIN 
                    ubicacion AS iu ON iu.idUbicacion = k.idUbicacion
                WHERE 
                        k.idCompra = ?
                    AND 
                        k.idProducto = ?
                ORDER BY 
                    k.idKardex ASC`, [
                    idCompra,
                    item.idProducto
                ]);

                item.inventarioDetalles = inventarioDetalles;
            }

            // Obtener información de transaccion asociados a la compra
            const transaccion = await conec.query(`
            SELECT 
                t.idTransaccion,
                DATE_FORMAT(t.fecha,'%d/%m/%Y') AS fecha,
                t.hora,
                c.nombre AS concepto,
                t.nota,
                pu.informacion AS usuario
            FROM 
                transaccion t            
            INNER JOIN
                concepto c ON c.idConcepto = t.idConcepto
            INNER JOIN 
                usuario AS us ON us.idUsuario = t.idUsuario
            INNER JOIN
                persona AS pu ON pu.idPersona = us.idPersona
            WHERE 
                t.idReferencia = ? AND t.estado = 1`, [
                idCompra
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

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSave(res, { cabecera: compra[0], detalles: listaDetalles, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/detail", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            const { idCompra, idUsuario } = req.query;

            // Inicia una transacción
            connection = await conec.beginTransaction();

            // Obtener fecha y hora actuales
            const date = currentDate();
            const time = currentTime();

            // Consulta la información de la compra que se va a cancelar
            const validate = await conec.execute(connection, `
            SELECT 
                idAlmacen,
                estado 
            FROM 
                compra 
            WHERE 
                idCompra = ?`, [
                idCompra,
            ]);

            // Verifica si la compra existe
            if (validate.length === 0) {
                // Si no existe, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return sendClient(res, "La compra no existe, verifique el código o actualiza la lista.");
            }

            // Actualiza el estado de la compra a anulado
            await conec.execute(connection, `
            UPDATE 
                compra 
            SET 
                estado = 3 
            WHERE 
                idCompra = ?`, [
                idCompra
            ]);

            // Actualiza el estado de la transacción asociada a la compra
            await conec.execute(connection, `
            UPDATE 
                transaccion 
            SET 
                estado = 0 
            WHERE 
                idReferencia = ?`, [
                idCompra
            ]);

            // Obtiene los detalles de la compra
            const detalleCompra = await conec.execute(connection, `
            SELECT 
                idProducto,
                costo,
                cantidad 
            FROM 
                compraDetalle 
            WHERE 
                idCompra = ?`, [
                idCompra
            ]);

            // Obtener ID kardex siguiente
            const resultKardex = await conec.execute(connection, `SELECT idKardex FROM kardex`);
            let idKardex = resultKardex.length ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Procesar cada detalle de la compra
            for (const detalle of detalleCompra) {
                // Obtener el kardex del compra por idProducto
                const kardexes = await conec.execute(connection, `
                SELECT 
                    k.idProducto,
                    k.cantidad,
                    k.costo,
                    k.idAlmacen,
                    k.lote,
                    k.idUbicacion,
                    k.fechaVencimiento
                FROM 
                    kardex AS k 
                WHERE 
                    k.idCompra = ? AND k.idProducto = ?`, [
                    idCompra,
                    detalle.idProducto,
                ]);

                for (const kardex of kardexes) {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idCompra,
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
                        kardex.idProducto,
                        KARDEX_TYPES.SALIDA,
                        KARDEX_MOTIVOS.DEVOLUCION,
                        idCompra,
                        'ANULACIÓN DE LA COMPRA',
                        kardex.cantidad,
                        kardex.costo,
                        kardex.idAlmacen,
                        kardex.lote,
                        kardex.idUbicacion,
                        kardex.fechaVencimiento,
                        date,
                        time,
                        idUsuario
                    ]);
                }
            }

            // Registrar auditoría
            await conec.execute(connection, `    
            INSERT INTO auditoria(
                idReferencia,
                idUsuario,
                tipo,
                descripción
            ) VALUES(?,?,?,?)`, [
                idCompra,
                idUsuario,
                "ELIMINAR",
                "SE ANULO LA COMPRA",
                date,
                time,
            ]);

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);

            // Enviar respuesta exitosa
            return sendSave(res, "Se anuló correctamente la compra.");
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/cancel", error);
        }
    }

    async listAccountsPayable(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cuenta_Pagar(?,?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Cuenta_Pagar_Count(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.tipo,
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/listAccountsPayable", error);
        }
    }

    async detailAccountsPayable(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                v.idCompra, 
                DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha,
                v.hora, 
                com.nombre AS comprobante,
                v.serie,
                v.numeracion,
                td.nombre AS tipoDocumento,       
                c.documento,
                c.informacion,
                c.direccion,
                p.nombre AS plazo,
                DATE_FORMAT(v.fechaVencimiento, '%d/%m/%Y') as fechaVencimiento,
                v.estado, 
                v.observacion,
                v.nota,
                m.codiso,
                pu.informacion AS usuario
            FROM 
                compra AS v 
            INNER JOIN
                plazo AS p ON p.idPlazo = v.idPlazo
            INNER JOIN 
                persona AS c ON v.idProveedor = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario
            INNER JOIN
                persona AS pu ON pu.idPersona = us.idPersona
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            WHERE 
                v.idCompra = ?`, [
                req.query.idCompra
            ]);

            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCompraDetalle ASC) AS id,
                p.idProducto,
                c.idAlmacen,
                p.imagen,
                 p.codigo,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                cd.costo,
                cd.cantidad,
                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                compraDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                compra AS c ON c.idCompra = cd.idCompra
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto  
            WHERE 
                cd.idCompra = ?
            ORDER BY 
                cd.idCompraDetalle ASC`, [
                req.query.idCompra
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                }
            });

            for (const item of listaDetalles) {
                const inventarioDetalles = await conec.query(`
                    SELECT 
                        invd.lote,
                        invd.cantidad,
                        CASE 
                            WHEN invd.fechaVencimiento IS NULL THEN NULL
                            ELSE DATE_FORMAT(invd.fechaVencimiento, '%d/%m/%Y')
                        END AS fechaVencimiento,
                        iu.descripcion AS ubicacion,
                        k.cantidad AS cantidadKardex,
                        k.costo
                    FROM 
                        kardex AS k
                    INNER JOIN 
                        inventarioDetalle AS invd ON invd.idInventarioDetalle = k.idInventarioDetalle AND invd.porDefecto <> 1
                    LEFT JOIN ubicacion AS iu 
                        ON iu.idUbicacion = invd.idUbicacion
                    WHERE 
                        k.idCompra = ?
                        AND k.idProducto = ?
                    ORDER BY 
                        k.idKardex ASC`, [
                    req.query.idCompra,
                    item.idProducto
                ]);

                item.inventarioDetalles = inventarioDetalles;
            }

            // Obtener el resumen de pagado
            const resumen = await conec.query(`
            SELECT 
                SUM(cd.cantidad * cd.costo) AS total,
                (
                    SELECT 
                        IFNULL(SUM(td.monto), 0)
                    FROM 
                        transaccion AS t
                    INNER JOIN 
                        transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                    WHERE 
                        t.idReferencia = c.idCompra AND t.estado = 1
                ) AS pagado
            FROM 
                compra AS c 
            INNER JOIN 
                compraDetalle AS cd ON cd.idCompra = c.idCompra
            WHERE 
                c.idCompra = ?`, [
                req.query.idCompra
            ]);

            // Obtener información de transaccion asociados a la compra
            const transaccion = await conec.query(`
                SELECT 
                    t.idTransaccion,
                    DATE_FORMAT(t.fecha,'%d/%m/%Y') AS fecha,
                    t.hora,
                    c.nombre AS concepto,
                    t.nota,
                    pu.informacion AS usuario
                FROM 
                    transaccion t            
                INNER JOIN
                    concepto c ON c.idConcepto = t.idConcepto
                INNER JOIN 
                    usuario AS us ON us.idUsuario = t.idUsuario
                INNER JOIN
                    persona AS pu ON pu.idPersona = us.idPersona
                WHERE 
                    t.idReferencia = ? AND t.estado = 1`, [
                req.query.idCompra
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

            return sendSuccess(res, { "cabecera": result[0], detalles: listaDetalles, resumen, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/detailAccountsPayable", error);
        }
    }

    async createAccountsPayable(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idCompra,
                idSucursal,
                idUsuario,
                monto,
                notaTransacion,
                bancosAgregados,
            } = req.body;

            const fecha = currentDate();
            const hora = currentTime();

            const resumen = await conec.execute(connection, `
            SELECT 
                SUM(cd.cantidad * cd.costo) AS total,
                (
                    SELECT 
                        IFNULL(SUM(td.monto), 0)
                    FROM 
                        transaccion AS t
                    INNER JOIN 
                        transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                    WHERE 
                        t.idReferencia = c.idCompra AND t.estado = 1
                ) AS pagado
            FROM 
                compra AS c 
            INNER JOIN 
                compraDetalle AS cd ON cd.idCompra = c.idCompra
            WHERE 
                c.idCompra = ?`, [
                idCompra
            ]);

            if (monto + resumen[0].pagado >= resumen[0].total) {
                await conec.execute(connection, `
                UPDATE 
                    compra
                SET 
                    estado = 1
                WHERE 
                    idCompra = ?`, [
                    idCompra
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
                estado,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                'CP0004',
                idCompra,
                idSucursal,
                notaTransacion,
                1,
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
            return sendSuccess(res, "Se registró correctamente su pago.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/createAccountsPayable", error);
        }
    }

    async cancelAccountsPayable(req, res) {
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
                req.query.idCompra
            ]);

            const sumaTransacciones = transacciones.reduce((accumulator, item) => accumulator + item.monto, 0);

            const compra = await conec.query(`
                SELECT 
                    SUM(cd.cantidad * cd.costo) AS total
                FROM 
                    compra AS c 
                INNER JOIN 
                    compraDetalle AS cd ON cd.idCompra = c.idCompra
                WHERE 
                    c.idCompra = ?`, [
                req.query.idCompra
            ]);

            if (sumaTransacciones - transaccion[0].monto < compra[0].total) {
                await conec.execute(connection, `
                UPDATE 
                    compra
                SET 
                    estado = 2
                WHERE 
                    idCompra = ?`, [
                    req.query.idCompra
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
                "SE ANULO LA TRANSACCIÓN DE COMPRA",
                date,
                time,
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se anuló correctamente su pago.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/createAccountsPayable", error);
        }
    }

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Compra(?,?,?,?,?,?)`, [
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
                "lista": result[3] ?? [],
                "total": result[4][0].total ?? 0,
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/test", error);
        }
    }

    async documentsPdfInvoices(req, res) {
        try {
            const { idCompra, size } = req.params;

            const bucket = firebaseService.getBucket();

            const empresa = await conec.query(`
            SELECT
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                tipoEnvio
            FROM 
                empresa`);

            const compra = await conec.query(`
            SELECT 
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,
                p.idSucursal,
                p.nota,
                --
                c.nombre AS comprobante,
                p.serie,
                p.numeracion,
                --
                cp.documento,
                cp.informacion,
                cp.direccion,
                --
                m.nombre AS moneda,
                m.simbolo,
                m.codiso,
                --
                pu.informacion AS usuario
            FROM 
                compra AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idProveedor
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            INNER JOIN
                persona AS pu ON pu.idPersona = u.idPersona
            WHERE 
                p.idCompra = ?`, [
                idCompra
            ]);

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
                s.idSucursal = ?`, [
                compra[0].idSucursal
            ]);

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idCompraDetalle ASC) AS id,
                p.codigo,
                p.nombre,
                p.imagen,
                gd.cantidad,
                gd.costo,
                m.nombre AS medida,
                i.idImpuesto,
                i.nombre AS impuesto,
                i.porcentaje
            FROM 
                compraDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN
                impuesto AS i ON i.idImpuesto = gd.idImpuesto
            WHERE 
                gd.idCompra = ?
            ORDER BY 
                gd.idCompraDetalle ASC`, [
                idCompra
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
                compra[0].idSucursal
            ]);

            return {
                "size": size,
                "company": {
                    ...empresa[0],
                    rutaLogo: empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
                },
                "branch": {
                    "nombre": sucursal[0].nombre,
                    "telefono": sucursal[0].telefono,
                    "celular": sucursal[0].celular,
                    "email": sucursal[0].email,
                    "paginaWeb": sucursal[0].paginaWeb,
                    "direccion": sucursal[0].direccion,
                    "ubigeo": {
                        "departamento": sucursal[0].departamento,
                        "provincia": sucursal[0].provincia,
                        "distrito": sucursal[0].distrito
                    }
                },
                "purchase": {
                    "fecha": compra[0].fecha,
                    "hora": compra[0].hora,
                    "nota": compra[0].nota,
                    "comprobante": {
                        "nombre": compra[0].comprobante,
                        "serie": compra[0].serie,
                        "numeracion": compra[0].numeracion
                    },
                    "proveedor": {
                        "documento": compra[0].documento,
                        "informacion": compra[0].informacion,
                        "direccion": compra[0].direccion
                    },
                    "moneda": {
                        "nombre": compra[0].moneda,
                        "simbolo": compra[0].simbolo,
                        "codiso": compra[0].codiso
                    },
                    "usuario": {
                        "apellidos": compra[0].apellidos,
                        "nombres": compra[0].nombres
                    },
                    "compraDetalles": detalles.map(item => {
                        return {
                            "id": item.id,
                            "cantidad": item.cantidad,
                            "costo": item.costo,
                            "producto": {
                                "codigo": item.codigo,
                                "nombre": item.nombre,
                            },
                            "medida": {
                                "nombre": item.medida,
                            },
                            "impuesto": {
                                "idImpuesto": item.idImpuesto,
                                "nombre": item.impuesto,
                                "porcentaje": item.porcentaje,
                            },

                        }
                    }),
                },
                "banks": bancos
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async documentsPdfAccountsPayable(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/purchase/pdf/account/payable`,
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/documentsPdfAccountsPayable", error);
        }
    }

    async documentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/purchase/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/purchase/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/documentsPdfExcel", error);
        }
    }

}

module.exports = Compra;