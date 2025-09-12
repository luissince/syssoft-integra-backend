const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const { sendClient, sendSuccess, sendError, sendFile } = require('../tools/Message');
const { default: axios } = require('axios');

class Persona {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Personas(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Personas_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/list", error);
        }
    }

    async listClientes(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Clientes(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Clientes_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/listClientes", error);
        }
    }

    async listProveedores(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Proveedores(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Proveedores_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/listProveedores", error);
        }
    }

    async listConductores(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Conductores(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Conductores_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/listConductores", error);
        }
    }

    async detail(req, res) {
        try {
            const {
                idPersona,
                posicionPaginaTransaccion,
                filasPorPaginaTransaccion,
                posicionPaginaVenta,
                filasPorPaginaVenta,
            } = req.body;

            const result = await conec.procedureAll(`CALL Detalle_Persona(?,?,?,?,?)`, [
                idPersona,
                parseInt(posicionPaginaTransaccion),
                parseInt(filasPorPaginaTransaccion),
                parseInt(posicionPaginaVenta),
                parseInt(filasPorPaginaVenta),
            ]);

            const data = {
                "persona": result[0][0],
                "sumaVentas": result[1][0].total ?? 0,
                "sumaCompras": result[2][0].total ?? 0,
                "sumaCuentasPorCobrar": result[3][0].total ?? 0,
                "sumaCuentasPorPagar": result[4][0].total ?? 0,
                "listaVentas": result[5] ?? [],

                "transacciones": result[6] ?? [],
                "totalTransacciones": result[7][0].total ?? 0,

                "ventas": result[8] ?? [],
                "totalVentas": result[9][0].total ?? 0,
            };

            return sendSuccess(res, data);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/detailt", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `
                SELECT 
                    informacion 
                FROM 
                    persona 
                WHERE 
                    documento = ?`, [
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`);
            }

            const result = await conec.execute(connection, 'SELECT idPersona FROM persona');
            const idPersona = generateAlphanumericCode("PN0001", result, 'idPersona');

            await conec.execute(connection, `INSERT INTO persona(
                idPersona, 
                idTipoDocumento,
                documento,
                informacion,

                cliente,
                proveedor,
                conductor,
                licenciaConducir,

                celular,
                telefono,
                fechaNacimiento,
                email, 
                clave,
                genero, 
                direccion,
                idUbigeo, 
                estadoCivil,
                predeterminado,
                estado, 
                observacion,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idPersona,
                req.body.idTipoDocumento,
                req.body.documento,
                req.body.informacion,

                req.body.cliente,
                req.body.proveedor,
                req.body.conductor,
                req.body.licenciaConducir,

                req.body.celular,
                req.body.telefono,
                req.body.fechaNacimiento,
                req.body.email,
                req.body.clave,
                req.body.genero,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.estadoCivil,
                false,
                req.body.estado,
                req.body.observacion,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente la persona.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/create", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                cn.idPersona,
                cn.idTipoDocumento,
                cn.documento,
                cn.informacion,
                cn.cliente,
                cn.proveedor,
                cn.conductor,
                cn.licenciaConducir,
                cn.celular,
                cn.telefono, 
                IFNULL(DATE_FORMAT(cn.fechaNacimiento,'%Y-%m-%d'),'') as fechaNacimiento,
                cn.email, 
                cn.clave,
                cn.genero,  
                cn.direccion,
                IFNULL(cn.idUbigeo,0) AS idUbigeo,
                IFNULL(u.ubigeo, '') AS ubigeo,
                IFNULL(u.departamento, '') AS departamento,
                IFNULL(u.provincia, '') AS provincia,
                IFNULL(u.distrito, '') AS distrito,
                cn.estadoCivil,
                cn.predeterminado,
                cn.estado, 
                cn.observacion
            FROM 
                persona AS cn 
            LEFT JOIN 
                ubigeo AS u ON u.idUbigeo = cn.idUbigeo
            WHERE 
                cn.idPersona = ?`, [
                req.query.idPersona,
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendSuccess(res, "Datos no encontrados");
            }
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `SELECT * FROM persona WHERE idPersona <> ? AND documento = ?`, [
                req.body.idPersona,
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return sendSuccess(res, `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`);
            }

            await conec.execute(connection, `
            UPDATE 
                persona
            SET
                idTipoDocumento=?, 
                documento=?,
                informacion=?, 
                cliente=?,
                proveedor=?,
                conductor=?,
                licenciaConducir=?,
                celular=?,
                telefono=?,
                fechaNacimiento=?,
                email=?,
                clave=?,
                genero=?, 
                direccion=?, 
                idUbigeo=?,
                estadoCivil=?, 
                estado=?,
                observacion=?,
                fupdate=?,
                hupdate=?,
                idUsuario=?
            WHERE 
                idPersona=?`, [
                req.body.idTipoDocumento,
                req.body.documento,
                req.body.informacion,

                req.body.cliente,
                req.body.proveedor,
                req.body.conductor,
                req.body.licenciaConducir,

                req.body.celular,
                req.body.telefono,
                req.body.fechaNacimiento,
                req.body.email,
                req.body.clave,
                req.body.genero,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.estadoCivil,
                req.body.estado,
                req.body.observacion,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idPersona
            ]);

            await conec.commit(connection)
            return sendSuccess(res, "Se actualizó correctamente la persona.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/update", error);
        }
    }

    async preferido(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const idPersona = req.query.idPersona;
            const rol = req.query.rol;

            if (rol === "1") {
                await conec.execute(connection, `UPDATE persona SET clientePreferido = 0`);

                await conec.execute(connection, `UPDATE persona SET clientePreferido = 1 WHERE idPersona = ?`, [
                    idPersona
                ]);
            }

            if (rol === "2") {
                await conec.execute(connection, `UPDATE persona SET proveedorPreferido = 0`);

                await conec.execute(connection, `UPDATE persona SET proveedorPreferido = 1 WHERE idPersona = ?`, [
                    idPersona
                ]);
            }

            if (rol === "3") {
                await conec.execute(connection, `UPDATE persona SET conductorPreferido = 0`);

                await conec.execute(connection, `UPDATE persona SET conductorPreferido = 1 WHERE idPersona = ?`, [
                    idPersona
                ]);
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se actualizó correctamente el estado de preferencia.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/preferido", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const cobro = await conec.execute(connection, `SELECT * FROM cobro WHERE idPersona = ?`, [
                req.query.idPersona
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede eliminar el cliente ya que esta ligada a un cobro.");
            }

            const gasto = await conec.execute(connection, `SELECT * FROM gasto WHERE idPersona = ?`, [
                req.query.idPersona
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede eliminar el cliente ya que esta ligada a un gasto.");
            }

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idCliente = ?`, [
                req.query.idPersona
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede eliminar el cliente ya que esta ligada a una venta.");
            }

            await conec.execute(connection, `DELETE FROM persona WHERE idPersona  = ?`, [
                req.query.idPersona
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se eliminó correctamente la persona.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/delete", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idPersona, 
                documento, 
                informacion 
            FROM 
                persona
            WHERE 
                estado = 1`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/combo", error);
        }
    }

    async filtrar(req, res) {
        try {
            const result = await conec.procedure(`CALL Filtrar_Persona(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.filter,
                Boolean(req.query.cliente),
                Boolean(req.query.proveedor),
                Boolean(req.query.conductor),
            ]);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/filtrar", error);
        }
    }

    async predeterminado(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idPersona, 
                idTipoDocumento,
                documento, 
                informacion,
                IFNULL(celular,'') AS celular,
                IFNULL(email,'') AS email,
                IFNULL(direccion,'') AS direccion
            FROM 
                persona
            WHERE 
                ? IS NOT NULL AND clientePreferido = 1 AND estado = 1
                OR
                ? IS NOT NULL AND proveedorPreferido = 1 AND estado = 1
                OR
                ? IS NOT NULL AND conductorPreferido = 1 AND estado = 1`, [
                req.query.cliente,
                req.query.proveedor,
                req.query.conductor,
            ]);
            if (result.length !== 0) {
                return sendSuccess(res, result[0]);
            }
            return sendSuccess(res, "");
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/predeterminado", error);
        }
    }

     async login(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idPersona, 
                idTipoDocumento,
                documento, 
                informacion,
                IFNULL(telefono,'') AS telefono,
                IFNULL(celular,'') AS celular,
                IFNULL(email,'') AS email,
                IFNULL(direccion,'') AS direccion
            FROM 
                persona
            WHERE 
                email = ? AND clave = ?`, [
                req.body.email,
                req.body.password,
            ]);
            if (result.length === 0) {
                return sendClient(res, "Credenciales incorrectas.");
            }
            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/predeterminado", error);
        }
    }

     async updateWeb(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const { idPersona } = req.params;

            const validate = await conec.execute(connection, `SELECT * FROM persona WHERE idPersona <> ? AND documento = ?`, [
                req.body.idPersona,
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return sendSuccess(res, `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`);
            }

            await conec.execute(connection, `
            UPDATE 
                persona
            SET
                idTipoDocumento=?, 
                documento=?,
                informacion=?, 
                celular=?,
                telefono=?,
                email=?,
                clave=?,
                direccion=?, 
                fupdate=?,
                hupdate=?
            WHERE 
                idPersona=?`, [
                req.body.idTipoDocumento,
                req.body.documento,
                req.body.informacion,
                req.body.celular,
                req.body.telefono,
                req.body.email,
                !req.body.clave ? validate[0].clave : req.body.clave,
                req.body.direccion,
                currentDate(),
                currentTime(),
                idPersona
            ]);

            await conec.commit(connection)
            return sendSuccess(res, {
                message: "Persona actualizada correctamente.",
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Persona/update", error);
        }
    }

    async clienteDocumentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/person/pdf/customer/reports`,
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

    async clienteDocumentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/person/excel/customer`,
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

    async proveedorDocumentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/person/pdf/supplier/reports`,
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

    async proveedorDocumentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/person/excel/supplier`,
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

module.exports = Persona;