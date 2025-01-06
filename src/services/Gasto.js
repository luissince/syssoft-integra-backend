const { currentDate, currentTime, generateNumericCode, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const { sendSuccess, sendError, sendSave, sendClient, sendFile } = require('../tools/Message');
const { default: axios } = require('axios');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

require('dotenv').config();

class Gasto {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Gastos(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Gastos_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                estado,
                observacion,
                nota,
                idConcepto,
                monto,
                notaTransacion,
                bancosAgregados
            } = req.body;

            /**
            * Generar un código unico para el gasto. 
            */
            const resultCobro = await conec.execute(connection, 'SELECT idGasto FROM gasto');
            const idGasto = generateAlphanumericCode("GT0001", resultCobro, 'idGasto');

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

            const gastos = await conec.execute(connection, `SELECT 
                numeracion  
                FROM gasto 
                WHERE idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, gastos, "numeracion");

            /**
             * Proceso para ingresar el gasto.
             */

            // Proceso de registro
            await conec.execute(connection, `INSERT INTO gasto(
                idGasto,
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                serie,
                numeracion,
                estado,
                observacion,
                nota,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idGasto,
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                comprobante[0].serie,
                numeracion,
                estado,
                observacion,
                nota,
                currentDate(),
                currentTime(),
            ]);

            /**
             * Proceso para ingresar los detalles del gasto.
             */

            // Generar el Id único
            const listaGastoDetalle = await conec.execute(connection, 'SELECT idGastoDetalle FROM gastoDetalle');
            let idGastoDetalle = generateNumericCode(1, listaGastoDetalle, 'idGastoDetalle');

            // Proceso de registro  
            await await conec.execute(connection, `INSERT INTO gastoDetalle(
                    idGastoDetalle,
                    idGasto,
                    idConcepto,
                    cantidad,
                    monto
                ) VALUES(?,?,?,?,?)`, [
                idGastoDetalle,
                idGasto,
                idConcepto,
                1,
                monto,
            ])

            /**
             * Proceso para registrar la lista de salidas con sus método de pagos
             */

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
                idConcepto,
                idGasto,
                idSucursal,
                notaTransacion,
                1,
                currentDate(),
                currentTime(),
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
            return sendSave(res, {
                idGasto: idGasto,
                message: "Se completo el proceso correctamente."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/create", error);
        }
    }

    async detail(req, res) {
        try {
            const gasto = await conec.query(`
            SELECT 
                g.idGasto,
                co.nombre AS comprobante,
                g.serie,
                g.numeracion,
                DATE_FORMAT(g.fecha,'%d/%m/%Y') AS fecha,
                g.hora,
                g.observacion,
                g.nota,
                cn.documento,
                cn.informacion,
                g.estado,
                m.codiso,
                u.apellidos,
                u.nombres
            FROM 
                gasto AS g
            INNER JOIN 
                persona AS cn on cn.idPersona = g.idPersona
            INNER JOIN 
                comprobante AS co on co.idComprobante = g.idComprobante
            INNER JOIN 
                moneda AS m on m.idMoneda = g.idMoneda
            INNER JOIN 
                usuario AS u ON u.idUsuario = g.idUsuario
            WHERE 
                g.idGasto = ?`, [
                req.query.idGasto
            ]);

            const detalles = await conec.query(`
            SELECT 
                cp.nombre,
                gd.cantidad,
                gd.monto
            FROM 
                gastoDetalle as gd
            INNER JOIN 
                concepto as cp on cp.idConcepto = gd.idConcepto
            WHERE 
                gd.idGasto = ?`, [
                req.query.idGasto
            ]);

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
                req.query.idGasto
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

            return sendSuccess(res, { "cabecera": gasto[0], detalles, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/list", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const exists = await conec.execute(connection, `
            SELECT 
                estado 
            FROM 
                gasto 
            WHERE 
                idGasto = ? AND estado = 0`, [
                req.query.idGasto
            ]);

            if (exists.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El gasto ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                gasto 
            SET 
                estado = 0 
            WHERE 
                idGasto = ?`, [
                req.query.idGasto
            ]);

            await conec.execute(connection, `
            UPDATE 
                transaccion 
            SET 
                estado = 0 
            WHERE 
                idReferencia = ?`, [
                req.query.idGasto
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente el gasto.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/cancel", error);
        }
    }

    async documentsPdfInvoices(req, res) {
        try {
            const { idGasto, size } = req.params;

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

            const gasto = await conec.query(`
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
                gasto AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idPersona
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idGasto = ?`, [
                idGasto
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
                gasto[0].idSucursal
            ]);

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idGastoDetalle ASC) AS id,
                p.codigo AS codigo,
                p.nombre AS concepto,
                gd.cantidad,
                gd.monto
            FROM 
                gastoDetalle AS gd
            INNER JOIN 
                concepto AS p ON gd.idConcepto = p.idConcepto
            WHERE 
                gd.idGasto = ?
            ORDER BY 
                gd.idGastoDetalle ASC`, [
                idGasto
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
                "expense": {
                    "fecha": gasto[0].fecha,
                    "hora": gasto[0].hora,
                    "nota": gasto[0].nota,
                    "comprobante": {
                        "nombre": gasto[0].comprobante,
                        "serie": gasto[0].serie,
                        "numeracion": gasto[0].numeracion
                    },
                    "proveedor": {
                        "documento": gasto[0].documento,
                        "informacion": gasto[0].informacion,
                        "direccion": gasto[0].direccion
                    },
                    "moneda": {
                        "nombre": gasto[0].moneda,
                        "simbolo": gasto[0].simbolo,
                        "codiso": gasto[0].codiso
                    },
                    "usuario": {
                        "apellidos": gasto[0].apellidos,
                        "nombres": gasto[0].nombres
                    },
                    "gastoDetalles": detalles.map(item => {
                        return {
                            "id": item.id,
                            "cantidad": item.cantidad,
                            "monto": item.monto,
                            "concepto": {
                                "codigo": item.codigo,
                                "nombre": item.concepto,
                            },
                        }
                    }),
                },
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async documentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/expense/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/expense/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },                
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendSuccess(res, response.data);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Gasto/documentsPdfExcel", error);
        }
    }

}

module.exports = Gasto;