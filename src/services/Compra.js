const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, sleep, } = require('../tools/Tools');
const { sendSave, sendError, sendSuccess, sendClient, sendFile } = require('../tools/Message');
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

class Compra {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Compras(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
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

            const total = await conec.procedure(`CALL Listar_Compras_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            // return { "result": resultLista, "total": total[0].Total };
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
                numeroCuotas,
                frecuenciaPago,
                notaTransacion,
                importeTotal
            } = req.body;

            if (idOrdenCompra) {
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

                const ordenCompraDetalles = await conec.query(`
                    SELECT 
                        cd.idProducto,
                        cd.costo,
                        cd.cantidad
                    FROM
                        ordenCompraDetalle AS cd
                    WHERE
                        cd.idOrdenCompra = ?`, [idOrdenCompra]);

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

                            if (["TT0001", "TT0004", "TT0003"].includes(item.idTipoTratamientoProducto)) {
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
                numeroCuota,
                frecuenciaPago,
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
                !numeroCuotas ? 0 : numeroCuotas,
                !frecuenciaPago ? null : frecuenciaPago,
                observacion,
                nota,
                estado,
                date,
                time,
            ]);

            // Genera un nuevo ID para los detalles de compra
            const listaCompraDetalle = await conec.execute(connection, `
            SELECT 
                idCompraDetalle 
            FROM 
                compraDetalle`);
            let idCompraDetalle = generateNumericCode(1, listaCompraDetalle, 'idCompraDetalle');

            // Consulta el último ID de Kardex
            const resultKardex = await conec.execute(connection, `
            SELECT 
                idKardex 
            FROM 
                kardex`);
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Inserta los detalles de compra en la base de datos
            for (const item of detalles) {
                const cantidad = !item.lote ? item.cantidad : item.lotes.reduce((acumulador, lote) => acumulador + + Number(lote.cantidad.value), 0);

                // Calcular es costo actual en base a la formula de costo promedio ponderado
                const valorTotalInventarioInicial = await conec.execute(connection, `
                SELECT 
                    i.cantidad,
                    IFNULL(SUM(i.cantidad * p.costo), 0) AS total
                FROM 
                    inventario as i
                JOIN
                    producto as p ON i.idProducto = p.idProducto
                WHERE 
                    i.idProducto = ? and i.idAlmacen = ?`, [
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
                }

                // Obtener inventario
                const inventario = await conec.execute(connection, `
                SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacen,
                ]);

                // Inserta información en el Kardex
                if (!item.lote) {
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
                        idInventario,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        `KD${String(idKardex += 1).padStart(4, '0')}`,
                        item.idProducto,
                        'TK0001',
                        'MK0002',
                        idCompra,
                        'INGRESO POR COMPRA',
                        cantidad,
                        item.costo,
                        idAlmacen,
                        inventario[0].idInventario,
                        date,
                        time,
                        idUsuario
                    ]);
                }

                // Actualiza el inventario
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    cantidad,
                    inventario[0].idInventario
                ]);

                if (item.lote) {
                    for (const lote of item.lotes) {
                        await conec.execute(connection, `
                        INSERT INTO lote (
                            idInventario,
                            codigoLote,
                            fechaVencimiento,
                            cantidad
                        ) VALUES(?,?,?,?)`, [
                            inventario[0].idInventario,
                            lote.serie.value,
                            lote.fechaVencimiento.value,
                            lote.cantidad.value
                        ]);

                        // Obtener el ID insertado
                        const [idLote] = await conec.execute(connection, 'SELECT LAST_INSERT_ID() AS id');

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
                            idInventario,
                            idLote,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            `KD${String(idKardex += 1).padStart(4, '0')}`,
                            item.idProducto,
                            'TK0001',
                            'MK0002',
                            idCompra,
                            `INGRESO POR COMPRA (LOTE: ${lote.serie.value})`,
                            lote.cantidad.value,
                            item.costo,
                            idAlmacen,
                            inventario[0].idInventario,
                            idLote.id,
                            date,
                            time,
                            idUsuario
                        ]);
                    }

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
            }

            // Si el tipo de compra es contado
            if (idFormaPago === 'FP0001') {
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

            // Si el tipo de compra es crédito
            if (idFormaPago === "FP0002") {
                const listPlazos = await conec.execute(connection, 'SELECT idPlazo FROM plazo');
                let idPlazo = generateNumericCode(1, listPlazos, 'idPlazo');

                let current = new Date();

                let monto = importeTotal / parseFloat(numeroCuotas);

                let i = 0;
                let plazo = 0;
                while (i < numeroCuotas) {
                    let now = new Date(current);

                    if (parseInt(frecuenciaPago) > 15) {
                        now.setDate(now.getDate() + 30);
                    } else {
                        now.setDate(now.getDate() + 15);
                    }

                    i++;
                    plazo++;

                    await conec.execute(connection, `
                    INSERT INTO plazo(
                        idPlazo,
                        idCompra,
                        plazo,
                        fecha,
                        hora,
                        monto,
                        estado
                    ) VALUES(?,?,?,?,?,?,?)`, [
                        idPlazo,
                        idCompra,
                        plazo,
                        now.getFullYear() + "-" + ((now.getMonth() + 1) < 10 ? "0" + (now.getMonth() + 1) : (now.getMonth() + 1)) + "-" + now.getDate(),
                        time,
                        monto,
                        0
                    ]);

                    idPlazo++;
                    current = now;
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
                    ) 
                    VALUES
                        (?,?,?,?,?,?)`, [
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
            // Consulta la información principal de la compra
            const compra = await conec.query(`
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
                al.nombre AS almacen,
                fc.nombre AS tipo,
                c.estado,
                c.observacion,
                c.nota,
                mo.codiso,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
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
                usuario AS us ON us.idUsuario = c.idUsuario 
            WHERE 
                c.idCompra = ?`, [
                req.query.idCompra,
            ]);

            // Consulta los detalles de la compra
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCompraDetalle ASC) AS id,
                p.idProducto,
                p.lote,
                c.idAlmacen,
                p.imagen,
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
                req.query.idCompra,
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
                if (item.lote === 1) {
                    // Buscar el ID de inventario
                    const inventario = await conec.query(`
                    SELECT 
                        idInventario 
                    FROM 
                        inventario 
                    WHERE 
                        idProducto = ? AND idAlmacen = ?`, [
                        item.idProducto,
                        item.idAlmacen
                    ]);

                    if (inventario.length > 0) {
                        const lotes = await conec.query(`
                        SELECT 
                            l.codigoLote,
                            DATE_FORMAT(l.fechaVencimiento, '%d/%m/%Y') AS fechaVencimiento,
                            l.cantidad
                        FROM 
                            lote AS l
                        INNER JOIN
                            kardex AS k ON l.idLote = k.idLote
                        WHERE 
                            l.idInventario = ? AND k.idCompra = ?`, [
                            inventario[0].idInventario,
                            req.query.idCompra,
                        ]);

                        item.lotes = lotes;
                    } else {
                        item.lotes = [];
                    }
                } else {
                    item.lotes = null;
                }
            }

            // Obtener información de transaccion asociados a la compra
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

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSave(res, { cabecera: compra[0], detalles: listaDetalles, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/detail", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
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
                req.query.idCompra
            ]);

            // Verifica si la compra existe
            if (validate.length === 0) {
                // Si no existe, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return sendClient(res, "La compra no existe, verifique el código o actualiza la lista.");
            }

            // Verifica si la compra ya está anulada
            if (validate[0].estado === 3) {
                // Si ya está anulada, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return sendClient(res, "La compra ya se encuentra anulada.");
            }

            // Actualiza el estado de la compra a anulado
            await conec.execute(connection, `
            UPDATE 
                compra 
            SET 
                estado = 3 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            // Actualiza el estado de la transacción asociada a la compra
            await conec.execute(connection, `
            UPDATE 
                transaccion 
            SET 
                estado = 0 
            WHERE 
                idReferencia = ?`, [
                req.query.idCompra
            ]);

            // Actualizar el estado de cuotas
            await conec.execute(connection, `
            UPDATE 
                plazo 
            SET 
                estado = 0 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            // Obtener cuotas y eliminar transacciones relacionadas
            const plazos = await conec.execute(connection, `
            SELECT
                idPlazo
            FROM
                plazo
            WHERE
                idCompra = ?`, [
                req.query.idCompra
            ]);

            for (const plazo of plazos) {
                await conec.execute(connection, `
                    DELETE FROM 
                        plazoTransaccion 
                    WHERE 
                        idPlazo = ?`, [
                    plazo.idPlazo,
                ]);
            }

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
                req.query.idCompra
            ]);

            // Obtener ID kardex siguiente
            const resultKardex = await conec.execute(connection, `SELECT idKardex FROM kardex`);
            let idKardex = resultKardex.length > 0
                ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", ''))))
                : 0;

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
                    k.idInventario,
                    k.idLote  
                FROM 
                    kardex AS k 
                WHERE 
                    k.idCompra = ? AND k.idProducto = ?`, [
                    req.query.idCompra,
                    detalle.idProducto,
                ]);

                for (const kardex of kardexes) {
                    // Si el producto tiene lote, restaurar la cantidad del lote
                    if (kardex.idLote) {
                        await conec.execute(connection, `
                        UPDATE 
                            lote 
                        SET 
                            cantidad = cantidad + ?,
                            estado = 0
                        WHERE 
                            idLote = ?`, [
                            kardex.cantidad,
                            kardex.idLote
                        ]);

                        // Inserta un nuevo registro en el kardex
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
                            idInventario,
                            idLote,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            kardex.idProducto,
                            'TK0002',
                            'MK0004',
                            req.query.idCompra,
                            'ANULACIÓN DE LA COMPRA',
                            kardex.cantidad,
                            kardex.costo,
                            kardex.idAlmacen,
                            kardex.idInventario,
                            kardex.idLote,
                            date,
                            time,
                            req.query.idUsuario
                        ]);
                    } else {
                        // Inserta un nuevo registro en el kardex
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
                            idInventario,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            generarIdKardex(),
                            kardex.idProducto,
                            'TK0002',
                            'MK0004',
                            req.query.idCompra,
                            'ANULACIÓN DE LA COMPRA',
                            kardex.cantidad,
                            kardex.costo,
                            kardex.idAlmacen,
                            kardex.idInventario,
                            date,
                            time,
                            req.query.idUsuario
                        ]);
                    }

                    // Actualiza la cantidad en el inventario
                    await conec.execute(connection, `
                    UPDATE 
                        inventario 
                    SET 
                        cantidad = cantidad - ?
                    WHERE 
                        idInventario = ?`, [
                        kardex.cantidad,
                        kardex.idInventario
                    ]);
                }
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
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
                com.nombre AS comprobante,
                com.codigo as codigoCompra,
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
                compra AS v 
            INNER JOIN 
                persona AS c ON v.idProveedor = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
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
                ROW_NUMBER() OVER (ORDER BY vd.idCompraDetalle ASC) AS id,
                p.imagen,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                vd.costo,
                vd.cantidad,
                vd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                compraDetalle AS vd 
            INNER JOIN 
                producto AS p ON vd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE 
                vd.idCompra = ?
            ORDER BY 
                vd.idCompraDetalle ASC`, [
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
                ) AS cobrado
            FROM 
                compra AS c 
            INNER JOIN 
                compraDetalle AS cd ON cd.idCompra = c.idCompra
            WHERE 
                c.idCompra = ?`, [
                req.query.idCompra
            ]);

            const plazos = await conec.query(`
            SELECT 
                idPlazo,
                plazo,
                DATE_FORMAT(fecha, '%d/%m/%Y') AS fecha,
                monto,
                estado
            FROM 
                plazo 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            for (const plazo of plazos) {
                const transacciones = await conec.query(`
                    SELECT 
                        t.idTransaccion,
                        DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha,
                        t.hora,
                        c.nombre AS concepto,
                        t.nota,
                        CONCAT(us.nombres,' ',us.apellidos) AS usuario   
                    FROM 
                        plazo AS p
                    INNER JOIN 
                        plazoTransaccion AS pi ON pi.idPlazo = p.idPlazo
                    INNER JOIN 
                        transaccion AS t ON t.idTransaccion = pi.idTransaccion
                    INNER JOIN
                        concepto c ON c.idConcepto = t.idConcepto
                    INNER JOIN 
                        usuario AS us ON us.idUsuario = t.idUsuario 
                    WHERE 
                        t.estado = 1 AND p.idPlazo = ?`, [
                    plazo.idPlazo
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

                plazo.transacciones = transacciones;
            }

            return sendSuccess(res, { "cabecera": result[0], detalles: listaDetalles, resumen, plazos });
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
                idPlazo,
                idUsuario,
                monto,
                notaTransacion,
                bancosAgregados,
            } = req.body;

            const plazo = await conec.execute(connection, `SELECT monto FROM plazo WHERE idPlazo = ?`, [
                idPlazo
            ]);

            const plazoTransaccion = await conec.execute(connection, `
            SELECT 
                SUM(td.monto) AS monto
            FROM 
                plazoTransaccion AS ct
            INNER JOIN 
                plazo as cu ON cu.idPlazo = ct.idPlazo
            INNER JOIN 
                transaccion as tn ON tn.idTransaccion = ct.idTransaccion
            INNER JOIN
                transaccionDetalle AS td ON td.idTransaccion = tn.idTransaccion
            WHERE 
                ct.idPlazo = ? AND tn.estado = 1`, [
                idPlazo
            ]);

            const plazoMonto = plazo[0].monto;

            const plazoEchos = plazoTransaccion.reduce((accumulator, item) => accumulator + item.monto, 0)

            if (monto + plazoEchos >= plazoMonto) {
                await conec.execute(connection, `
                UPDATE 
                    plazo
                SET 
                    estado = 1
                WHERE 
                    idPlazo = ?`, [
                    idPlazo
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
                idCompra
            ]);

            const sumaTransacciones = transacciones.reduce((accumulator, item) => accumulator + item.monto, 0);

            const compra = await conec.query(`
            SELECT 
                c.idSucursal,
                SUM(cd.cantidad * cd.costo) AS total
            FROM 
                compra AS c 
            INNER JOIN 
                compraDetalle AS cd ON cd.idCompra = c.idCompra
            WHERE 
                c.idCompra = ?`, [
                idCompra
            ]);

            if (sumaTransacciones + monto >= compra[0].total) {
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
                compra[0].idSucursal,
                notaTransacion,
                1,
                currentDate(),
                currentTime(),
                idUsuario
            ]);

            await conec.execute(connection, `
                INSERT INTO plazoTransaccion(
                    idPlazo,
                    idTransaccion
                ) VALUES(?,?)`, [
                idPlazo,
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

            const validate = await conec.execute(connection, `
                SELECT * FROM 
                    plazoTransaccion 
                WHERE 
                    idPlazo = ? AND idTransaccion = ?`, [
                req.query.idPlazo,
                req.query.idTransaccion,
            ]);

            if (validate.length === 0) {
                // Si no existe, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return sendClient(res, "El pago no existe, actualize su vista.");
            }

            const plazo = await conec.execute(connection, `SELECT monto FROM plazo WHERE idPlazo = ?`, [
                req.query.idPlazo,
            ]);

            const plazoTransaccion = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    plazoTransaccion AS ct
                INNER JOIN 
                    plazo as cu ON cu.idPlazo = ct.idPlazo
                INNER JOIN 
                    transaccion as tn ON tn.idTransaccion = ct.idTransaccion
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = tn.idTransaccion
                WHERE 
                    ct.idPlazo = ? AND tn.estado = 1`, [
                req.query.idPlazo,
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

            const plazoMonto = plazo[0].monto;

            const plazoEchos = plazoTransaccion.reduce((accumulator, item) => accumulator + item.monto, 0);

            const monto = transaccion[0].monto;

            if (plazoEchos - monto < plazoMonto) {
                await conec.execute(connection, `
                    UPDATE 
                        plazo 
                    SET 
                        estado = 0 
                    WHERE 
                        idPlazo = ?`, [
                    req.query.idPlazo
                ]);
            }

            await conec.execute(connection, `
                DELETE FROM 
                    plazoTransaccion 
                WHERE 
                    idPlazo = ? AND idTransaccion = ?`, [
                req.query.idPlazo,
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

            if (sumaTransacciones - monto < compra[0].total) {
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
                u.apellidos,
                u.nombres
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
            console.log(req.params.idPlazo);
            console.log(req.params.idCompra);
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