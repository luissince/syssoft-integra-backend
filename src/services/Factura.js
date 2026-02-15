const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendFile } = require('../tools/Message');
const axios = require('axios').default;
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');

class Factura {

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
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                venta AS v 
            INNER JOIN
                plazo AS p ON p.idPlazo = v.idPlazo
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
                ROW_NUMBER() OVER (ORDER BY vd.idVentaDetalle ASC) AS id,
                p.imagen,
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
                   t.idReferencia = ? AND t.estado = 1`, [
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

            return sendSuccess(res, { "cabecera": result[0], detalles: listaDetalles, resumen, transaccion });
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
                    SUM(cd.cantidad * cd.precio) AS total,
                    (
                        SELECT 
                            IFNULL(SUM(td.monto), 0)
                        FROM 
                            transaccion AS t
                        INNER JOIN 
                            transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                        WHERE 
                            t.idReferencia = v.idVenta AND t.estado = 1
                    ) AS cobrado
                FROM 
                    venta AS v 
                INNER JOIN 
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                WHERE 
                    v.idVenta = ?`, [
                idVenta
            ]);

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
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                'CP0004',
                idVenta,
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

            const compra = await conec.query(`
                SELECT 
                    SUM(cd.cantidad * cd.precio) AS total
                FROM 
                    venta AS v
                INNER JOIN 
                    ventaDetalle AS cd ON cd.idCompra = v.idVenta
                WHERE 
                    v.idVenta = ?`, [
                req.query.idVenta
            ]);

            if (sumaTransacciones - transaccion[0].monto < compra[0].total) {
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
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/sale/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
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

}

module.exports = Factura;