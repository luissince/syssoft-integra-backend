const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const logger = require('../tools/Logger');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Persona {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Personas(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

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

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listClientes(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Clientes(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

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

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listProveedores(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Proveedores(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

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

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listConductores(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Conductores(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

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

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `SELECT informacion FROM persona WHERE documento = ?`, [
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
            }

            const result = await conec.execute(connection, 'SELECT idPersona FROM persona');
            const idPersona = generateAlphanumericCode("PN0001", result, 'idPersona');

            await conec.execute(connection, `INSERT INTO persona(
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
                telefono,
                fechaNacimiento,
                email, 
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
                req.body.idTipoCliente,
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
                req.body.genero,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.estadoCivil,
                req.body.predeterminado,
                req.body.estado,
                req.body.observacion,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ]);

            await conec.commit(connection);
            return "create";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            const result = await conec.query(`
            SELECT 
                cn.idPersona,
                cn.idTipoCliente,
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
                return result[0];
            } else {
                return "Datos no encontrados";
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `SELECT * FROM persona WHERE idPersona <> ? AND documento = ?`, [
                req.body.idPersona,
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
            }

            if (req.body.predeterminado) {
                await conec.execute(connection, `UPDATE persona SET predeterminado = 0`);
            }

            await conec.execute(connection, `UPDATE persona
            SET
                idTipoCliente=?,
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
                genero=?, 
                direccion=?, 
                idUbigeo=?,
                estadoCivil=?, 
                predeterminado=?,
                estado=?,
                observacion=?,
                fupdate=?,
                hupdate=?,
                idUsuario=?
            WHERE 
                idPersona=?`, [
                req.body.idTipoCliente,
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
                req.body.genero,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.estadoCivil,
                req.body.predeterminado,
                req.body.estado,
                req.body.observacion,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idPersona
            ]);

            await conec.commit(connection)
            return "update";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }      
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async delete(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const cobro = await conec.execute(connection, `SELECT * FROM cobro WHERE idPersona = ?`, [
                req.query.idPersona
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a un cobro.';
            }

            const gasto = await conec.execute(connection, `SELECT * FROM gasto WHERE idPersona = ?`, [
                req.query.idPersona
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a un gasto.';
            }

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idCliente = ?`, [
                req.query.idPersona
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a una venta.';
            }

            await conec.execute(connection, `DELETE FROM persona WHERE idPersona  = ?`, [
                req.query.idPersona
            ]);

            await conec.commit(connection);
            return "delete";
        } catch (error) {
            logger.error(`Empresa/update: ${error.message ?? error}`)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async combo(req) {
        try {
            const result = await conec.query(`
            SELECT 
                idPersona, 
                documento, 
                informacion 
            FROM 
                persona`);
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async filtrar(req) {
        try {   
            const result = await conec.procedure(`CALL Filtrar_Persona(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.filter,
                Boolean(req.query.cliente),
                Boolean(req.query.proveedor),
                Boolean(req.query.conductor),
            ]); 
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async predeterminado(req) {
        try {
            const result = await conec.query(`
            SELECT 
                idPersona, 
                idTipoCliente,
                idTipoDocumento,
                documento, 
                informacion,
                IFNULL(celular,'') AS celular,
                IFNULL(email,'') AS email,
                IFNULL(direccion,'') AS direccion
            FROM 
                persona
            WHERE 
                predeterminado = 1`);
            if (result.length !== 0) {
                return result[0];
            }
            return "";
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}


module.exports = Persona;