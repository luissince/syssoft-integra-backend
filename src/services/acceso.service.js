const { sendSuccess, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const conec = new Conexion();

class Acceso {

    async accesos(data) {
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
            data.idPerfil,
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
            data.idPerfil,
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
                pp.idPerfil = ?
            ORDER BY
                pp.idPrivilegio`, [
            data.idPerfil,
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
            data.idPerfil,
        ]);

        return { menu, subMenu, privilegio, perfilSucursales };
    }

    async save(data) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            for (const menu of data.menus) {
                await conec.execute(connection, `
                UPDATE 
                    permisoMenu 
                SET 
                    estado = ? 
                WHERE 
                    idPerfil  = ? AND idMenu = ?`, [
                    menu.estado,
                    data.idPerfil,
                    menu.idMenu
                ]);

                for (const submenu of menu.children) {
                    await conec.execute(connection, `
                        UPDATE 
                            permisoSubMenu 
                        SET 
                            estado = ?
                        WHERE 
                            idPerfil = ? AND idMenu = ? AND idSubMenu = ?`, [
                        submenu.estado,
                        data.idPerfil,
                        menu.idMenu,
                        submenu.idSubMenu
                    ]);

                    for (const privilegio of submenu.children) {
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
                            data.idPerfil,
                        ]);
                    }
                }
            }

            await conec.execute(connection, `DELETE FROM perfilSucursal WHERE idPerfil = ?`, [
                data.idPerfil,
            ]);

            for (const sucursal of data.sucursales) {
                if (sucursal.estado === 1) {
                    await conec.execute(connection, `INSERT INTO perfilSucursal(idPerfil, idSucursal, fecha, hora) VALUES(?,?,?,?)`, [
                        data.idPerfil,
                        sucursal.idSucursal,
                        currentDate(),
                        currentTime(),
                    ]);
                }
            }

            await conec.commit(connection);
            return "Se registro correctamente el acceso.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async update(data) {
        let connection = null;
        try {

            connection = await conec.beginTransaction();

            await conec.execute(connection, `DELETE FROM permisoMenu WHERE idPerfil  = ?`, [
                data.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoSubMenu WHERE idPerfil  = ?`, [
                data.idPerfil
            ]);

            await conec.execute(connection, `DELETE FROM permisoPrivilegio WHERE idPerfil  = ?`, [
                data.idPerfil
            ]);

            const menus = await conec.execute(connection, `SELECT idMenu,nombre FROM menu`);

            for (const menu of menus) {
                let estadoMenu = 0;
                for (const menuold of data.menus) {
                    if (menuold.idMenu === menu.idMenu) {
                        estadoMenu = menuold.estado;
                        break;
                    }
                }

                await conec.execute(connection, `INSERT INTO permisoMenu(idPerfil ,idMenu ,estado)values(?,?,?)`, [
                    data.idPerfil,
                    menu.idMenu,
                    estadoMenu
                ]);

                const submenus = await conec.execute(connection, `SELECT idSubMenu FROM subMenu WHERE idMenu = ?`, [
                    menu.idMenu
                ]);

                for (const submenu of submenus) {

                    let estadoSubMenu = 0;
                    for (const menuold of data.menus) {
                        for (const submenuold of menuold.children) {
                            if (menuold.idMenu === menu.idMenu && submenuold.idSubMenu === submenu.idSubMenu) {
                                estadoSubMenu = submenuold.estado;
                                break;
                            }
                        }
                    }

                    await conec.execute(connection, `INSERT INTO permisoSubMenu(idPerfil, idMenu ,idSubMenu, estado)values(?,?,?,?)`, [
                        data.idPerfil,
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
                        for (const menuold of data.menus) {
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
                            data.idPerfil,
                            estadoPrivilegio
                        ]);
                    }
                }
            }

            await conec.commit(connection);
            return "Modulos actualizados correctamente.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async validarMenu(idUsuario, idMenu) {
        const sql = `
            SELECT 
                m.nombre,
                pmp.estado 
            FROM
                usuario u
            JOIN
                perfil p ON u.idPerfil = p.idPerfil
            JOIN
                permisoMenu pmp ON pmp.idPerfil = p.idPerfil
            JOIN
                menu m ON pmp.idMenu = m.idMenu
            WHERE 
                    u.idUsuario = ? 
                AND 
                    pmp.idMenu = ?`;
        const [row] = await conec.query(sql, [idUsuario, idMenu]);
        return row && row.estado === 1 ? true : false;
    }

    async validarSubMenu(idUsuario, idMenu, idSubMenu) {
        const sql = `
            SELECT 
                sm.nombre,
                pms.estado
            FROM
                usuario u
            JOIN
                perfil p ON u.idPerfil = p.idPerfil
            JOIN
                permisoMenu pmp ON pmp.idPerfil = p.idPerfil
            JOIN
                menu m ON pmp.idMenu = m.idMenu
            JOIN 
                permisoSubMenu pms ON pms.idPerfil = pmp.idPerfil AND pms.idMenu = m.idMenu 
            JOIN 
                subMenu sm ON sm.idSubMenu = pms.idSubMenu AND sm.idMenu = m.idMenu
            WHERE 
                    u.idUsuario = ? 
                AND 
                    pmp.idMenu = ?
                AND
                    sm.idSubMenu = ?`;
        const [row] = await conec.query(sql, [idUsuario, idMenu, idSubMenu]);
        return row && row.estado === 1 ? true : false;
    }

    async validarPrivilegio(idUsuario, idMenu, idSubMenu, idPrivilegio) {
        const sql = `
            SELECT 
                pv.nombre,
                pmpv.estado 
            FROM
                usuario u
            JOIN
                perfil p ON u.idPerfil = p.idPerfil
            JOIN
                permisoMenu pmp ON pmp.idPerfil = p.idPerfil
            JOIN
                menu m ON pmp.idMenu = m.idMenu
            JOIN 
                permisoSubMenu pms ON pms.idPerfil = pmp.idPerfil AND pms.idMenu = m.idMenu 
            JOIN 
                subMenu sm ON sm.idSubMenu = pms.idSubMenu AND sm.idMenu = m.idMenu
            JOIN
                permisoPrivilegio pmpv ON pmpv.idPerfil = pms.idPerfil AND pmpv.idMenu = m.idMenu AND pmpv.idSubMenu = sm.idSubMenu
            JOIN
                privilegio pv ON pv.idPrivilegio = pmpv.idPrivilegio AND pv.idSubMenu = sm.idSubMenu AND pv.idMenu = m.idMenu

            WHERE 
                    u.idUsuario = ? 
                AND 
                    pmp.idMenu = ?
                AND
                    sm.idSubMenu = ?
                AND 
                    pv.idPrivilegio = ?`;
        const [row] = await conec.query(sql, [idUsuario, idMenu, idSubMenu, idPrivilegio]);
        return row && row.estado === 1 ? true : false;
    }

}

module.exports = new Acceso();