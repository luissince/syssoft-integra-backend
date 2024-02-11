const Conexion = require('../database/Conexion');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { currentDate, currentTime } = require('../tools/Tools');
const { sendSuccess, sendClient, sendSave, sendError } = require('../tools/Message');
const conec = new Conexion();

class Usuario {

    async list(req, res) {
        try {

            let lista = await conec.query(`SELECT 
            u.idUsuario,
            u.dni,
            u.nombres,
            u.apellidos,
            u.telefono,
            u.email,
            u.representante,
            IFNULL(p.descripcion,'-') AS perfil,
            u.estado
            FROM usuario AS u 
            LEFT JOIN perfil AS p ON u.idPerfil  = p.idPerfil
            WHERE 
            ? = 0
            OR
            ? = 1 and u.nombres like concat(?,'%')
            OR
            ? = 1 and u.apellidos like concat(?,'%')
            OR
            ? = 1 and u.dni like concat(?,'%')
            LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            let resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            let total = await conec.query(`SELECT COUNT(*) AS Total 
            FROM usuario AS u LEFT JOIN perfil AS p ON u.idPerfil  = p.idPerfil
            WHERE 
            ? = 0
            OR
            ? = 1 and u.nombres like concat(?,'%')
            OR
            ? = 1 and u.apellidos like concat(?,'%')
            OR
            ? = 1 and u.dni like concat(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let result = await conec.execute(connection, 'SELECT idUsuario FROM usuario');
            let idUsuario = "";
            if (result.length != 0) {

                let quitarValor = result.map(function (item) {
                    return parseInt(item.idUsuario.replace("US", ''));
                });

                let valorActual = Math.max(...quitarValor);
                let incremental = valorActual + 1;
                let codigoGenerado = "";
                if (incremental <= 9) {
                    codigoGenerado = 'US000' + incremental;
                } else if (incremental >= 10 && incremental <= 99) {
                    codigoGenerado = 'US00' + incremental;
                } else if (incremental >= 100 && incremental <= 999) {
                    codigoGenerado = 'US0' + incremental;
                } else {
                    codigoGenerado = 'US' + incremental;
                }

                idUsuario = codigoGenerado;
            } else {
                idUsuario = "US0001";
            }

            let hash = "";
            if (req.body.activeLogin) {
                const salt = bcrypt.genSaltSync(saltRounds);
                hash = bcrypt.hashSync(req.body.clave, salt);

                let usuario = await conec.execute(connection, `SELECT * FROM usuario
                WHERE usuario = ?`, [
                    req.body.usuario,
                ]);

                if (usuario.length > 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "Hay un usuario con el mismo valor.");
                }
            }

            await conec.execute(connection, `INSERT INTO usuario(
                idUsuario, 
                nombres, 
                apellidos, 
                dni, 
                genero, 
                direccion, 
                telefono, 
                email,
                idPerfil, 
                representante, 
                estado, 
                login,
                usuario, 
                clave,
                fecha,
                hora,
                fupdate,
                hupdate ) 
                VALUES(?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?)`, [
                idUsuario,
                req.body.nombres,
                req.body.apellidos,
                req.body.dni,
                req.body.genero,
                req.body.direccion,
                req.body.telefono,
                req.body.email,
                req.body.idPerfil,
                req.body.representante,
                req.body.estado,
                req.body.activeLogin,
                req.body.usuario,
                hash,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
            ])

            await conec.commit(connection);
            return sendSave(res, 'Los datos se registrarón correctamente.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.activeLogin) {
                let usuario = await conec.execute(connection, `SELECT * FROM usuario
                WHERE usuario = ? AND idUsuario <> ?`, [
                    req.body.usuario,
                    req.body.idUsuario
                ]);

                if (usuario.length > 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "Hay un usuario con el mismo valor.");
                }
            }

            await conec.execute(connection, `UPDATE usuario SET 
            nombres=?, 
            apellidos=?, 
            dni=?, 
            genero=?, 
            direccion=?, 
            telefono=?, 
            email=?, 
            idPerfil=?, 
            representante=?, 
            estado=?, 
            login=?,
            usuario=?,
            fupdate=?,
            hupdate=?
            WHERE idUsuario=?`, [
                req.body.nombres,
                req.body.apellidos,
                req.body.dni,
                req.body.genero,
                req.body.direccion,
                req.body.telefono,
                req.body.email,
                req.body.idPerfil,
                req.body.representante,
                req.body.estado,
                req.body.activeLogin,
                req.body.usuario,
                currentDate(),
                currentTime(),
                req.body.idUsuario
            ])

            await conec.commit(connection)
            return sendSave(res, "Los datos se actualizarón correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let venta = await conec.execute(connection, `SELECT * FROM venta WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligada a una venta.');
            }

            let empresa = await conec.execute(connection, `SELECT * FROM empresa WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (empresa.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligada a una empresa.');
            }

            let sucursal = await conec.execute(connection, `SELECT * FROM sucursal WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (sucursal.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un sucursal.');
            }

            let perfil = await conec.execute(connection, `SELECT * FROM perfil WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (perfil.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligada a un perfil.');
            }

            let moneda = await conec.execute(connection, `SELECT * FROM moneda WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (moneda.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligada a una moneda.');
            }

            let categoria = await conec.execute(connection, `SELECT * FROM categoria WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (categoria.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligada a una categoria.');
            }

            let producto = await conec.execute(connection, `SELECT * FROM producto WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (producto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un producto.');
            }

            let impuesto = await conec.execute(connection, `SELECT * FROM impuesto WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (impuesto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un impuesto.');
            }

            let gasto = await conec.execute(connection, `SELECT * FROM gasto WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un gasto.');
            }

            let concepto = await conec.execute(connection, `SELECT * FROM concepto WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (concepto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un concepto.');
            }

            let comprobante = await conec.execute(connection, `SELECT * FROM comprobante WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (comprobante.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un comprobante.');
            }

            let cobro = await conec.execute(connection, `SELECT * FROM cobro WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un cobro.');
            }

            let cliente = await conec.execute(connection, `SELECT * FROM persona WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (cliente.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un cliente.');
            }

            let bancoDetalle = await conec.execute(connection, `SELECT * FROM bancoDetalle WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (bancoDetalle.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un bancoDetalle.');
            }

            let banco = await conec.execute(connection, `SELECT * FROM banco WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            if (banco.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el usuario ya que esta ligado a un banco.');
            }

            await conec.execute(connection, `DELETE FROM usuario WHERE idUsuario = ?`, [
                req.query.idUsuario
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se eliminó correctamente el usuario.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async reset(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let usuario = await conec.execute(connection, `SELECT * FROM usuario WHERE idUsuario = ? AND login = 0`, [
                req.body.idUsuario
            ]);

            if (usuario.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, "El usuario no tiene cuenta para resetear su contraseña.");
            }

            const salt = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync(req.body.clave, salt);

            await conec.execute(connection, `UPDATE usuario SET
            clave = ?
            WHERE idUsuario=?`, [
                hash,
                req.body.idUsuario
            ]);

            await conec.commit(connection)
            return sendSave(res, "Se actualizó la contraseña correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            let result = await conec.query('SELECT * FROM usuario WHERE idUsuario  = ?', [
                req.query.idUsuario
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, "Datos no encontrados");
            }

        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async listcombo(req, res) {
        try {
            let result = await conec.query(`SELECT 
                idUsuario, nombres, apellidos, dni, estado
                FROM usuario`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }
}

module.exports = new Usuario();