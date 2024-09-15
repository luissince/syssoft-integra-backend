const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, sleep, } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const { sendSave, sendError, sendSuccess, sendClient } = require('../tools/Message');
const conec = new Conexion();

class Compra {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Compras(?,?,?,?,?)`, [
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

            // Extrae los datos del cuerpo de la solicitud
            const {
                idComprobante,
                idProveedor,
                idUsuario,
                idSucursal,
                idAlmacen,
                idMoneda,
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
                currentDate(),
                currentTime()
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

                // Insertar kardex
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
                    item.cantidad,
                    item.idImpuesto
                ]);

                // Inserta información en el Kardex
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
                    hora,
                    fecha,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    `KD${String(idKardex += 1).padStart(4, '0')}`,
                    item.idProducto,
                    'TK0001',
                    'MK0002',
                    idCompra,
                    'INGRESO POR COMPRA',
                    item.cantidad,
                    item.costo,
                    idAlmacen,
                    inventario[0].idInventario,
                    currentTime(),
                    currentDate(),
                    idUsuario
                ]);

                // Actualiza el inventario
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    item.cantidad,
                    inventario[0].idInventario
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
                        nota,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?)`, [
                    idTransaccion,
                    'CP0002',
                    idCompra,
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
           * Proceso cuando la compra es al crédito fijo
           */
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
                        currentTime(),
                        monto,
                        0
                    ]);

                    idPlazo++;
                    current = now;
                }
            }

            // Confirma la transacción
            await conec.commit(connection);
            return sendSave(res, "Se registró correctamente la compra.");
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
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto  
            WHERE 
                cd.idCompra = ?`, [
                req.query.idCompra,
            ]);

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
            return sendSave(res, { cabecera: compra[0], detalles, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/detail", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            // Inicia una transacción
            connection = await conec.beginTransaction();

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

            await conec.execute(connection, `
            UPDATE 
                plazo 
            SET 
                estado = 0 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

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

            // Genera el Id del kardex
            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Itera sobre los detalles de la compra para realizar acciones en el kardex e inventario
            for (const item of detalleCompra) {
                // Obtiene el kardex asociado
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
                    k.idCompra = ? AND k.idProducto = ?`, [
                    req.query.idCompra,
                    item.idProducto,
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
                    hora,
                    fecha,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    `KD${String(idKardex += 1).padStart(4, '0')}`,
                    item.idProducto,
                    'TK0002',
                    'MK0004',
                    req.query.idCompra,
                    'ANULACIÓN DE LA COMPRA',
                    kardex[0].cantidad,
                    kardex[0].costo,
                    kardex[0].idAlmacen,
                    kardex[0].idInventario,
                    currentTime(),
                    currentDate(),
                    req.query.idUsuario
                ]);

                // Actualiza la cantidad en el inventario
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad - ?
                WHERE 
                    idInventario = ?`, [
                    kardex[0].cantidad,
                    kardex[0].idInventario
                ]);
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

            return sendSuccess(res, { "cabecera": result[0], detalles, resumen, plazos });
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
                    nota,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                'CP0004',
                idCompra,
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

}

module.exports = Compra;