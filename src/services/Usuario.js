const Conexion = require('../database/Conexion');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const resultUsuario = await conec.execute(connection, 'SELECT idUsuario FROM usuario');
            const idUsuario = generateAlphanumericCode("US0001", resultUsuario, 'idUsuario');

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
                    hupdate 
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/add", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.activeLogin) {
                const usuario = await conec.execute(connection, `
                SELECT 
                    idUsuario 
                FROM 
                    usuario
                WHERE 
                    usuario = ? AND idUsuario <> ?`, [
                    req.body.usuario,
                    req.body.idUsuario
                ]);

                if (usuario.length > 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "Hay un usuario con el mismo valor.");
                }
            }

            await conec.execute(connection, `UPDATE usuario 
            SET 
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
            WHERE   
                idUsuario=?`, [
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/update", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const tablesToCheck = [
                'venta', 'empresa', 'sucursal', 'perfil', 'moneda', 
                'categoria', 'producto', 'impuesto', 'gasto', 'concepto',
                'comprobante', 'cobro', 'persona', 'bancoDetalle', 'banco'
            ];

            for (const table of tablesToCheck) {
                const queryResult = await conec.execute(connection, `SELECT * FROM ${table} WHERE idUsuario = ?`, [
                    req.query.idUsuario
                ]);
    
                if (queryResult.length > 0) {
                    await conec.rollback(connection);
                    return sendClient(res, `No se puede eliminar el usuario ya que está ligado a ${table}.`);
                }
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/delete", error);
        }
    }

    async reset(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const usuario = await conec.execute(connection, `SELECT * FROM usuario WHERE idUsuario = ? AND login = 0`, [
                req.body.idUsuario
            ]);

            if (usuario.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, "El usuario no tiene cuenta para resetear su contraseña.");
            }

            const salt = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync(req.body.clave, salt);

            await conec.execute(connection, `UPDATE usuario 
            SET
                clave = ?
            WHERE 
                idUsuario=?`, [
                hash,
                req.body.idUsuario
            ]);

            await conec.commit(connection)
            return sendSave(res, "Se actualizó la contraseña correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/reset", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query('SELECT * FROM usuario WHERE idUsuario  = ?', [
                req.query.idUsuario
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, "Datos no encontrados");
            }

        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/id", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`
                SELECT 
                    idUsuario, 
                    nombres, 
                    apellidos,
                    dni,
                    estado
                FROM 
                    usuario`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Usuario/combo", error);
        }
    }
}

module.exports = new Usuario();