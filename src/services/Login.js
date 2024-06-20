const bcrypt = require('bcrypt');
const { create } = require('../tools/Jwt');
const { sendSuccess, sendError, sendClient, sendExpired } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Login {

    async createsession(req, res) {
        try {
            const validate = await conec.query(`SELECT idUsuario, clave FROM usuario 
            WHERE usuario = ?`, [
                req.query.usuario,
            ]);

            if (validate.length == 0) {
                return sendClient(res, "Datos incorrectos, intente nuevamente.");
            }

            const hash = bcrypt.compareSync(req.query.password, validate[0].clave);
            if (!hash) {
                return sendClient(res, "Datos incorrectos, intente nuevamente.");
            }


            const usuario = await conec.query(`SELECT 
                    u.idUsuario, 
                    u.nombres,
                    u.apellidos,
                    u.idPerfil,
                    u.estado,
                    u.login,
                    p.descripcion AS rol
                    FROM usuario AS u
                    INNER JOIN perfil AS p ON u.idPerfil = p.idPerfil
                    WHERE u.idUsuario = ?`, [
                validate[0].idUsuario
            ]);

            if (usuario[0].estado === 0) {
                return sendClient(res, "Su cuenta se encuentra inactiva.");
            }

            if (usuario[0].login === 0) {
                return sendClient(res, "Su cuenta no tiene acceso al sistema.");
            }

            const user = {
                idUsuario: usuario[0].idUsuario,
                nombres: usuario[0].nombres,
                apellidos: usuario[0].apellidos,
                estado: usuario[0].estado,
                rol: usuario[0].rol
            }

            const menus = await conec.query(`
                    SELECT 
                    m.idMenu,
                    m.nombre,
                    m.ruta,
                    pm.estado,
                    m.icon 
                    FROM permisoMenu as pm 
                    INNER JOIN perfil as p on pm.idPerfil = p.idPerfil
                    INNER JOIN menu as m on pm.idMenu = m.idMenu
                    WHERE p.idPerfil = ?
                    `, [
                usuario[0].idPerfil,
            ]);

            const subMenus = await conec.query(`
                    SELECT 
                    sm.idMenu,
                    sm.idSubMenu,
                    sm.nombre,
                    sm.ruta,
                    psm.estado
                    FROM permisoSubMenu as psm
                    INNER JOIN perfil AS p ON psm.idPerfil = p.idPerfil
                    INNER JOIN subMenu AS sm on sm.idMenu = psm.idMenu and sm.idSubMenu = psm.idSubMenu
                    WHERE psm.idPerfil = ?
                    `, [
                usuario[0].idPerfil,
            ]);

            const privilegios = await conec.query(`SELECT
                    pp.idPrivilegio,
                    pp.idSubMenu,
                    pp.idMenu,
                    pv.nombre,
                    pp.estado
                    FROM permisoPrivilegio AS pp
                    INNER JOIN perfil AS p ON p.idPerfil = pp.idPerfil
                    INNER JOIN privilegio AS pv ON pv.idPrivilegio = pp.idPrivilegio AND pv.idSubMenu = pp.idSubMenu AND pv.idMenu = pp.idMenu
                    WHERE pp.idPerfil = ?`, [
                usuario[0].idPerfil,
            ]);

            const token = await create(user, 'userkeylogin');

            const data = menus.map((mn) => {

                let submenu = [];

                for (const sb of subMenus) {
                    let privilegio = [];

                    if (mn.idMenu === sb.idMenu) {

                        for (const priv of privilegios) {

                            if (priv.idSubMenu === sb.idSubMenu && mn.idMenu === priv.idMenu) {
                                privilegio.push({
                                    estado: priv.estado,
                                    idMenu: priv.idMenu,
                                    idPrivilegio: priv.idPrivilegio,
                                    idSubMenu: priv.idSubMenu,
                                    nombre: priv.nombre,
                                });
                            }
                        }

                        submenu.push({
                            estado: sb.estado,
                            idMenu: sb.idMenu,
                            idSubMenu: sb.idSubMenu,
                            nombre: sb.nombre,
                            ruta: sb.ruta,
                            privilegio: privilegio,
                        });
                    }
                }

                return {
                    ...mn,
                    submenu,
                };
            });

            return sendSuccess(res, {
                ...user,
                token,
                menus: data
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async validtoken(_, res) {
        return sendSuccess(res, "Ok");
    }
}

module.exports = new Login();