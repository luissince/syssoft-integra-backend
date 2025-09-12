const conec = require('../database/mysql-connection');
const { sendError, sendSuccess, sendFile } = require('../tools/Message');
const { default: axios } = require('axios');
const FirebaseService = require('../tools/FiraseBaseService');
const firebaseService = new FirebaseService();

class Transaccion {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Transacciones(?,?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idTipoConcepto,
                req.query.idSucursal,
                req.query.idUsuario,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina),
                }
            });

            for (const item of resultLista) {
                const detalles = await conec.query(`
                SELECT 
                    b.nombre,
                    td.monto 
                FROM 
                    transaccionDetalle as td
                INNER JOIN 
                    banco AS b ON b.idBanco = td.idBanco
                WHERE
                    td.idTransaccion = ?`, [
                    item.idTransaccion
                ]);

                item.detalles = detalles;
            }

            const total = await conec.procedure(`CALL Listar_Transacciones_Count(?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idTipoConcepto,
                req.query.idSucursal,
                req.query.idUsuario,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Transaccion/list", error);
        }
    }

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Financiero(?,?,?,?,?,?)`, [
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                req.query.idUsuario,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            return sendSuccess(res, {
                "ingreso": result[0][0].total ?? 0,
                "egreso": result[1][0].total ?? 0,
                "bancos": result[2] ?? [],
                "ingresos": result[3] ?? [],
                "egresos": result[4] ?? [],
                "lista": result[5] ?? [],
                "total": result[6][0].total ?? 0,
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Transaccion/dashboard", error);
        }
    }

    async documentsPdfReports(req, res) {
        try {
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
                    ? = '' AND s.principal = 1 OR s.idSucursal = ?`, [
                req.query.idSucursal,
                req.query.idSucursal,
            ]);

            const moneda = await conec.query(`
                SELECT 
                    m.simbolo,
                    m.codiso
                FROM
                    moneda AS m
                WHERE
                    m.nacional = 1`);

            const usuario = await conec.query(`
                SELECT 
                    CONCAT(u.nombres,', ',u.apellidos) AS nombre
                    
                FROM
                     usuario AS u
                WHERE
                    u.idUsuario = ? `, [
                req.query.idUsuario,
            ]);

            const data = await conec.query(`CALL Reporte_Financiero(?,?,?,?)`, [
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                req.query.idUsuario,
            ]);

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/transaction/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    size: req.query.size,
                    company: {
                        ...empresa[0],
                        rutaLogo: empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
                    },
                    branch: {
                        nombre: sucursal[0].nombre,
                        telefono: sucursal[0].telefono,
                        celular: sucursal[0].celular,
                        email: sucursal[0].email,
                        paginaWeb: sucursal[0].paginaWeb,
                        direccion: sucursal[0].direccion,
                        ubigeo: {
                            departamento: sucursal[0].departamento,
                            provincia: sucursal[0].provincia,
                            distrito: sucursal[0].distrito
                        }
                    },
                    currency: {
                        simbolo: moneda[0].simbolo,
                        codiso: moneda[0].codiso,
                    },
                    startDate: req.query.fechaInicio,
                    endDate: req.query.fechaFinal,
                    nameBranch: req.query.idSucursal === '' ? 'TODOS' : sucursal[0].nombre,
                    nameUser: req.query.idUsuario === '' ? 'TODOS' : usuario[0].nombre,
                    income: data[0][0].total ?? 0,
                    expense: data[1][0].total ?? 0,
                    incomes: data[2] ?? [],
                    expenses: data[3] ?? [],
                    banks: data[4] ?? [],
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Transaccion/reporteFinanciero", error);
        }
    }

    calculateTaxBruto(tax, amount) {
        return amount / ((tax + 100) * 0.01);
    }

    calculateTax(porcent, amount) {
        const tax = porcent / 100.0;
        return amount * tax;
    }


}

module.exports = Transaccion;