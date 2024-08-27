const { sendSuccess, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

class Acceso {

    async accesos(req, res) {
        try {
            const menu = await conec.query(`
            SELECT 
                m.idMenu,
                m.nombre, 
                pm.estado 
            FROM 
                permisoMenu as pm 
            INNER JOIN 
                perfil as p on pm.idPerfil = p.idPerfil
            INNER JOIN 
                menu as m on pm.idMenu = m.idMenu
            WHERE 
                p.idPerfil = ?`, [
                req.query.idPerfil,
            ]);

            const subMenu = await conec.query(`
            SELECT 
                sm.idMenu,
                sm.idSubMenu,
                sm.nombre,
                psm.estado
            FROM 
                permisoSubMenu as psm
            INNER JOIN 
                perfil AS p ON psm.idPerfil = p.idPerfil
            INNER JOIN 
                subMenu AS sm on sm.idMenu = psm.idMenu and sm.idSubMenu = psm.idSubMenu
            WHERE 
                psm.idPerfil = ?
            `, [
                req.query.idPerfil,
            ]);

            const privilegio = await conec.query(`
            SELECT
                pp.idPrivilegio,
                pp.idSubMenu,
                pp.idMenu,
                pv.nombre, 
                pp.estado
            FROM 
                permisoPrivilegio AS pp
            INNER JOIN 
                perfil AS p ON p.idPerfil = pp.idPerfil
            INNER JOIN 
                privilegio AS pv ON pv.idPrivilegio = pp.idPrivilegio AND pv.idSubMenu = pp.idSubMenu AND pv.idMenu = pp.idMenu 
            WHERE 
                pp.idPerfil = ?`, [
                req.query.idPerfil,
            ]);

            const perfilSucursales = await conec.query(`
            SELECT
                s.idSucursal,
                s.nombre,
                CASE 
                    WHEN ps.idSucursal IS NOT NULL THEN 1
                    ELSE 0
                END AS estado
            FROM
                sucursal AS s
            LEFT JOIN
                perfilSucursal AS ps ON ps.idSucursal = s.idSucursal AND ps.idPerfil = ?`, [
                req.query.idPerfil,
            ]);

            return sendSuccess(res, { menu, subMenu, privilegio, perfilSucursales });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Acceso/accesos", error);
        }
    }

    async save(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            for (let menu of req.body.menus) {
                await conec.execute(connection, `
                UPDATE 
                    permisoMenu 
                SET 
                    estado = ? 
                WHERE 
                    idPerfil  = ? AND idMenu = ?`, [
                    menu.estado,
                    req.body.idPerfil,
                    menu.idMenu
                ]);

                for (let submenu of menu.children) {
                    await conec.execute(connection, `
                        UPDATE 
                            permisoSubMenu 
                        SET 
                            estado = ?
                        WHERE 
                            idPerfil = ? AND idMenu = ? AND idSubMenu = ?`, [
                        submenu.estado,
                        req.body.idPerfil,
                        menu.idMenu,
                        submenu.idSubMenu
                    ]);

                    for (let privilegio of submenu.children) {
                        await conec.execute(connection, `
                            UPDATE 
                                permisoPrivilegio 
                            SET 
                                estado = ?
                            WHERE 
                                idPrivilegio = ? AND idSubMenu = ? AND idMenu = ? AND idPerfil = ?`, [
                            privilegio.estado,
                            privilegio.idPrivilegio,
                            privilegio.idSubMenu,
                            privilegio.idMenu,
                            req.body.idPerfil,
                        ]);
                    }
                }
            }

            await conec.execute(connection, `DELETE FROM perfilSucursal WHERE idPerfil = ?`, [
                req.body.idPerfil,
            ]);

            for (const sucursal of req.body.sucursales) {
                if (sucursal.estado === 1) {
                    await conec.execute(connection, `INSERT INTO perfilSucursal(idPerfil, idSucursal, fecha, hora) VALUES(?,?,?,?)`, [
                        req.body.idPerfil,
                        sucursal.idSucursal,
                        currentDate(),
                        currentTime(),
                    ]);
                }
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se registro correctamente el acceso.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Acceso/save", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {

            connection = await conec.beginTransaction();

            await conec.execute(connection, `DELETE FROM permisoMenu WHERE idPerfil  = ?`, [
                req.body.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoSubMenu WHERE idPerfil  = ?`, [
                req.body.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoPrivilegio WHERE idPerfil  = ?`, [
                req.body.idPerfil
            ]);

            const menus = await conec.execute(connection, `SELECT idMenu,nombre FROM menu`);

            for (const menu of menus) {
                let estadoMenu = 0;
                for (const menuold of req.body.menus) {
                    if (menuold.idMenu === menu.idMenu) {
                        estadoMenu = menuold.estado;
                        break;
                    }
                }

                await conec.execute(connection, `INSERT INTO permisoMenu(idPerfil ,idMenu ,estado)values(?,?,?)`, [
                    req.body.idPerfil,
                    menu.idMenu,
                    estadoMenu
                ]);

                const submenus = await conec.execute(connection, `SELECT idSubMenu FROM subMenu WHERE idMenu = ?`, [
                    menu.idMenu
                ]);

                for (const submenu of submenus) {

                    let estadoSubMenu = 0;
                    for (const menuold of req.body.menus) {
                        for (const submenuold of menuold.children) {
                            if (menuold.idMenu === menu.idMenu && submenuold.idSubMenu === submenu.idSubMenu) {
                                estadoSubMenu = submenuold.estado;
                                break;
                            }
                        }
                    }

                    await conec.execute(connection, `INSERT INTO permisoSubMenu(idPerfil, idMenu ,idSubMenu, estado)values(?,?,?,?)`, [
                        req.body.idPerfil,
                        menu.idMenu,
                        submenu.idSubMenu,
                        estadoSubMenu
                    ]);

                    let privilegios = await conec.execute(connection, `SELECT idPrivilegio, idSubMenu, idMenu FROM privilegio WHERE idSubMenu = ? AND idMenu= ?`, [
                        submenu.idSubMenu,
                        menu.idMenu
                    ]);

                    for (const privilegio of privilegios) {
                        let estadoPrivilegio = 0;
                        for (const menuold of req.body.menus) {
                            for (const submenuold of menuold.children) {
                                for (const privilegioold of submenuold.children) {
                                    if (menuold.idMenu === menu.idMenu
                                        && submenuold.idSubMenu === submenu.idSubMenu
                                        && privilegioold.idPrivilegio === privilegio.idPrivilegio) {
                                        estadoPrivilegio = privilegioold.estado;
                                        break;
                                    }
                                }
                            }
                        }

                        await conec.execute(connection, `INSERT INTO permisoPrivilegio(idPrivilegio, idSubMenu ,idMenu, idPerfil, estado) VALUES (?,?,?,?,?)`, [
                            privilegio.idPrivilegio,
                            privilegio.idSubMenu,
                            privilegio.idMenu,
                            req.body.idPerfil,
                            estadoPrivilegio
                        ]);
                    }
                }
            }

            await conec.commit(connection);
            return sendSuccess(res, "Modulos actualizados correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Acceso/update", error);
        }
    }

}

module.exports = new Acceso();