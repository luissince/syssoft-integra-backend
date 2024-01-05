const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Cliente {

    async list(req) {
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

    async listsocios(req) {
        try {
            let lista = await conec.procedure(`CALL Listar_Socios(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idConcepto,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            let newLista = [];

            for (let value of lista) {
                let detalle = await conec.query(`SELECT 
                    l.descripcion,
                    m.nombre AS categoria
                    FROM venta AS v
                    INNER JOIN ventaDetalle AS vd ON vd.idVenta = v.idVenta
                    INNER JOIN producto AS l ON l.idProducto = vd.idProducto
                    INNER JOIN categoria AS m ON m.idCategoria = l.idCategoria
                    WHERE v.idVenta = ?`, [
                    value.idVenta
                ]);

                newLista.push({
                    ...value,
                    detalle
                });
            }

            const resultLista = newLista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Socios_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idConcepto,
                req.query.idSucursal
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            console.error(error);
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `SELECT informacion FROM clienteNatural WHERE documento = ?`, [
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
            }

            const result = await conec.execute(connection, 'SELECT idCliente FROM clienteNatural');
            const idCliente = generateAlphanumericCode("CN0001", result, 'idCliente');

            await conec.execute(connection, `INSERT INTO clienteNatural(
                idCliente, 
                idTipoCliente,
                idTipoDocumento,
                documento,
                informacion,
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
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idCliente,
                req.body.idTipoCliente,
                req.body.idTipoDocumento,
                req.body.documento,
                req.body.informacion,
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
            ])

            await conec.commit(connection);
            return "create";
        } catch (error) {
            console.log(error)
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
                cn.idCliente,
                cn.idTipoCliente,
                cn.idTipoDocumento,
                cn.documento,
                cn.informacion,
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
                clienteNatural AS cn 
            LEFT JOIN 
                ubigeo AS u ON u.idUbigeo = cn.idUbigeo
            WHERE 
                cn.idCliente = ?`, [
                req.query.idCliente,
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

            const validate = await conec.execute(connection, `SELECT * FROM clienteNatural WHERE idCliente <> ? AND documento = ?`, [
                req.body.idCliente,
                req.body.documento,
            ]);

            if (validate.length > 0) {
                await conec.rollback(connection);
                return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
            }

            if (req.body.predeterminado) {
                await conec.execute(connection, `UPDATE clienteNatural SET predeterminado = 0`);
            }

            await conec.execute(connection, `UPDATE clienteNatural
            SET
                idTipoCliente=?,
                idTipoDocumento=?, 
                documento=?,
                informacion=?, 
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
                idCliente=?`, [
                req.body.idTipoCliente,
                req.body.idTipoDocumento,
                req.body.documento,
                req.body.informacion,
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
                req.body.idCliente
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

            const cobro = await conec.execute(connection, `SELECT * FROM cobro WHERE idCliente = ?`, [
                req.query.idCliente
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a un cobro.';
            }

            const gasto = await conec.execute(connection, `SELECT * FROM gasto WHERE idCliente = ?`, [
                req.query.idCliente
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a un gasto.';
            }

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idCliente = ?`, [
                req.query.idCliente
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a una venta.';
            }

            await conec.execute(connection, `DELETE FROM clienteNatural WHERE idCliente  = ?`, [
                req.query.idCliente
            ]);

            await conec.commit(connection);
            return "delete";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listcombo(req) {
        try {
            const result = await conec.query('SELECT idCliente, documento, informacion FROM clienteNatural');
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async filtrar(req) {
        try {
            const result = await conec.query(`
            SELECT 
                cn.idCliente, 
                cn.documento, 
                cn.informacion
            FROM 
                clienteNatural AS cn
            WHERE 
                cn.documento LIKE CONCAT('%',?,'%')
                OR 
                cn.informacion LIKE CONCAT('%',?,'%')`, [
                req.query.filtrar,
                req.query.filtrar,
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
            idCliente, 
            documento, 
            informacion
            FROM clienteNatural
            WHERE predeterminado = 1`);
            if (result.length !== 0) {
                return result[0];
            }
            return "";
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}


module.exports = Cliente;