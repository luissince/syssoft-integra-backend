const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendClient, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Perfil {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT 
            p.idPerfil,
            s.nombreEmpresa as empresa,
            p.descripcion,
            DATE_FORMAT(p.fecha,'%d/%m/%Y') as fecha,
            p.hora
            FROM perfil AS p 
            INNER JOIN empresa AS s ON s.idEmpresa = p.idEmpresa 
            WHERE 
            ? = 0
            OR
            ? = 1 and p.descripcion like concat(?,'%')
            LIMIT ?,?`, [
                parseInt(req.query.opcion),

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

            const total = await conec.query(`SELECT COUNT(*) AS Total 
            FROM perfil AS p 
            INNER JOIN empresa AS s ON s.idEmpresa = p.idEmpresa 
            WHERE 
            ? = 0
            OR
            ? = 1 and p.descripcion like concat(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total })
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idPerfil FROM perfil');
            const idPerfil = generateAlphanumericCode("PF0001", result, 'idPerfil');

            await conec.execute(connection, `INSERT INTO perfil(
            idPerfil, 
            idEmpresa, 
            descripcion,
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario) 
            VALUES(?,?,?,?,?,?,?,?)`, [
                idPerfil,
                req.body.idEmpresa,
                req.body.descripcion,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ])

            const menus = await conec.execute(connection, `SELECT idMenu,nombre FROM menu`);
            for (const menu of menus) {
                await conec.execute(connection, `INSERT INTO permisoMenu(idPerfil ,idMenu ,estado)values(?,?,?)`, [
                    idPerfil,
                    menu.idMenu,
                    0
                ]);

                const submenus = await conec.execute(connection, `SELECT idSubMenu FROM subMenu WHERE idMenu = ?`, [
                    menu.idMenu
                ]);

                for (const submenu of submenus) {
                    await conec.execute(connection, `INSERT INTO permisoSubMenu(idPerfil ,idMenu , idSubMenu ,estado)values(?,?,?,?)`, [
                        idPerfil,
                        menu.idMenu,
                        submenu.idSubMenu,
                        0
                    ]);

                    const privilegios = await conec.execute(connection, `SELECT idPrivilegio, idSubMenu, idMenu FROM privilegio WHERE idSubMenu = ? AND idMenu=?`, [
                        submenu.idSubMenu,
                        menu.idMenu
                    ]);

                    for (const privilegio of privilegios) {
                        await conec.execute(connection, `INSERT INTO permisoPrivilegio(idPrivilegio, idSubMenu ,idMenu, idPerfil, estado) VALUES (?,?,?,?,?)`, [
                            privilegio.idPrivilegio,
                            privilegio.idSubMenu,
                            privilegio.idMenu,
                            idPerfil,
                            0
                        ])
                    }
                }
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente el perfil.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query('SELECT * FROM perfil WHERE idPerfil  = ?', [
                req.query.idPerfil,
            ]);

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res);
        }
    }

    async update(req, res) {
        let connection = null;
        try {

            connection = await conec.beginTransaction();

            await conec.execute(connection, `UPDATE perfil SET idEmpresa=?, descripcion=?, fecha=?, hora=?, idUsuario=? 
            WHERE idPerfil=?`, [
                req.body.idEmpresa,
                req.body.descripcion,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idPerfil
            ])

            await conec.commit(connection)
            return sendSuccess(res, "Se actualizó correctamente el Perfil.");
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

            const usuario = await conec.execute(connection, `SELECT * FROM usuario WHERE idPerfil = ?`, [
                req.query.idPerfil
            ]);

            if (usuario.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el perfil ya que esta ligada a un usuario.');
            }

            await conec.execute(connection, `DELETE FROM perfil WHERE idPerfil  = ?`, [
                req.query.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoMenu WHERE idPerfil  = ?`, [
                req.query.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoSubMenu WHERE idPerfil  = ?`, [
                req.query.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoPrivilegio WHERE idPerfil = ?`, [
                req.query.idPerfil
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se eliminó correctamente el Perfil.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query('SELECT idPerfil,descripcion FROM perfil');
            return sendSuccess(res, result);
        } catch (error) {           
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }
}

module.exports = new Perfil();