const { currentDate, currentTime, generateNumericCode, generateAlphanumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const { sendSuccess, sendError, sendSave, sendClient, sendFile } = require('../tools/Message');
const { default: axios } = require('axios');
const FirebaseService = require('../tools/FiraseBaseService');
const firebaseService = new FirebaseService();

class Cobro {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cobros(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Cobros_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/list", error);
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
                bancosAgregados,
            } = req.body;

            /**
            * Generar un código unico para el cobro. 
            */
            const resultCobro = await conec.execute(connection, 'SELECT idCobro FROM cobro');
            const idCobro = generateAlphanumericCode("CB0001", resultCobro, 'idCobro');

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
                idComprobante  = ?
            `, [
                idComprobante
            ]);

            const cobros = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                cobro 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, cobros, "numeracion");

            /**
             * Proceso para ingresar el cobro.
             */

            // Proceso de registro
            await conec.execute(connection, `
            INSERT INTO cobro(
                idCobro,
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
                idCobro,
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
             * Proceso para ingresar el detalle del cobro.
             */

            // Generar el Id único
            const listaCobroDetalle = await conec.execute(connection, 'SELECT idCobroDetalle FROM cobroDetalle');
            let idCobroDetalle = generateNumericCode(1, listaCobroDetalle, 'idCobroDetalle');

            // Proceso de registro  
            await await conec.execute(connection, `
            INSERT INTO cobroDetalle(
                idCobroDetalle,
                idCobro,
                idConcepto,
                cantidad,
                monto
            ) VALUES(?,?,?,?,?)`, [
                idCobroDetalle,
                idCobro,
                idConcepto,
                1,
                monto,
            ])

            /**
             * Proceso para registrar la lista de ingresos con sus método de pagos
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
                idCobro,
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
                idCobro: idCobro,
                message: "Se completo el proceso correctamente."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/list", error);
        }
    }

    async detail(req, res) {
        try {
            const cobro = await conec.query(`
            SELECT 
                c.idCobro,
                co.nombre AS comprobante,
                c.serie,
                c.numeracion,
                DATE_FORMAT(c.fecha,'%d/%m/%Y') AS fecha,
                c.hora,
                c.observacion,
                c.nota,
                cn.documento,
                cn.informacion,
                c.estado,
                m.codiso,
                u.apellidos,
                u.nombres
            FROM 
                cobro AS c
            INNER JOIN 
                persona AS cn on cn.idPersona = c.idPersona
            INNER JOIN 
                comprobante AS co on co.idComprobante = c.idComprobante
            INNER JOIN 
                moneda AS m on m.idMoneda = c.idMoneda
            INNER JOIN 
                usuario AS u ON u.idUsuario = c.idUsuario
            WHERE 
                c.idCobro = ?`, [
                req.query.idCobro
            ]);

            const detalles = await conec.query(`
            SELECT 
                cp.nombre,
                cb.cantidad,
                cb.monto
            FROM 
                cobroDetalle as cb
            INNER JOIN 
                concepto as cp on cp.idConcepto = cb.idConcepto
            WHERE 
                cb.idCobro = ?`, [
                req.query.idCobro
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
                req.query.idCobro
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

            return sendSuccess(res, { "cabecera": cobro[0], "detalles": detalles, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/list", error);
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
                cobro 
            WHERE 
                idCobro = ? AND estado = 0`, [
                req.query.idCobro
            ]);

            if (exists.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El cobro ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                cobro 
            SET 
                estado = 0 
            WHERE 
                idCobro = ?`, [
                req.query.idCobro
            ]);

            await conec.execute(connection, `
            UPDATE 
                transaccion 
            SET 
                estado = 0 
            WHERE 
                idReferencia = ?`, [
                req.query.idCobro
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente el cobro.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/list", error);
        }
    }

    async documentsPdfInvoices(req, res) {
        try {
            const { idCobro, size } = req.params;

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

            const cobro = await conec.query(`
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
                cobro AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idPersona
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idCobro = ?`, [
                idCobro
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
                cobro[0].idSucursal
            ]);

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idCobroDetalle ASC) AS id,
                p.codigo AS codigo,
                p.nombre AS concepto,
                gd.cantidad,
                gd.monto
            FROM 
                cobroDetalle AS gd
            INNER JOIN 
                concepto AS p ON gd.idConcepto = p.idConcepto
            WHERE 
                gd.idCobro = ?
            ORDER BY 
                gd.idCobroDetalle ASC`, [
                idCobro
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
                "collection": {
                    "fecha": cobro[0].fecha,
                    "hora": cobro[0].hora,
                    "nota": cobro[0].nota,
                    "comprobante": {
                        "nombre": cobro[0].comprobante,
                        "serie": cobro[0].serie,
                        "numeracion": cobro[0].numeracion
                    },
                    "cliente": {
                        "documento": cobro[0].documento,
                        "informacion": cobro[0].informacion,
                        "direccion": cobro[0].direccion
                    },
                    "moneda": {
                        "nombre": cobro[0].moneda,
                        "simbolo": cobro[0].simbolo,
                        "codiso": cobro[0].codiso
                    },
                    "usuario": {
                        "apellidos": cobro[0].apellidos,
                        "nombres": cobro[0].nombres
                    },
                    "cobroDetalles": detalles.map(item => {
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
                url: `${process.env.APP_PDF}/collection/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/collection/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendSuccess(res, response.data);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cobro/documentsPdfExcel", error);
        }
    }

}

module.exports = Cobro;