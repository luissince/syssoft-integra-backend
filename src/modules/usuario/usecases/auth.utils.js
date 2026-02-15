
const { clientError } = require('../../../tools/Error');

async function validateUserAccess(usuario) {
    if (usuario.estado === 0) {
        throw new clientError("Su cuenta se encuentra inactiva.");
    }

    if (usuario.login === 0) {
        throw new clientError("Su cuenta no tiene acceso al sistema.");
    }
}

async function getUser(conec, idUsuario) {
    const [usuario] = await conec.query(`
    SELECT 
        u.idUsuario,
        u.estado,
        pf.idPerfil,
        pf.descripcion AS perfil,
        p.informacion
    FROM 
        usuario u
    JOIN 
        persona p ON u.idPersona = p.idPersona
    JOIN 
        perfil pf ON u.idPerfil = pf.idPerfil
    WHERE 
        u.idUsuario = ?`, [
        idUsuario
    ]);

    return usuario;
}

async function getPermisosByPerfil(conec, idPerfil) {
    const menus = await conec.query(`
    SELECT 
        m.idMenu,
        m.nombre,
        m.ruta,
        pm.estado,
        m.icon 
    FROM 
        permisoMenu pm
    INNER JOIN 
        menu m ON pm.idMenu = m.idMenu
    WHERE 
        pm.idPerfil = ?`, [
        idPerfil
    ]);

    const subMenus = await conec.query(`
    SELECT 
        sm.idMenu,
        sm.idSubMenu,
        sm.nombre,
        sm.ruta,
        sm.icon,
        psm.estado
    FROM 
        permisoSubMenu psm
    INNER JOIN 
        subMenu sm ON sm.idMenu = psm.idMenu AND sm.idSubMenu = psm.idSubMenu
    WHERE 
        psm.idPerfil = ?
    ORDER BY 
        idSubMenu`, [
        idPerfil
    ]);

    const privilegios = await conec.query(`
    SELECT
        pp.idPrivilegio,
        pp.idSubMenu,
        pp.idMenu,
        pv.nombre,
        pp.estado
    FROM 
        permisoPrivilegio pp
    INNER JOIN 
        privilegio pv ON pv.idPrivilegio = pp.idPrivilegio AND pv.idSubMenu = pp.idSubMenu AND pv.idMenu = pp.idMenu
    WHERE 
        pp.idPerfil = ?`, [
        idPerfil
    ]);

    return generateMenus(menus, subMenus, privilegios);
}

function generateMenus(menus, subMenus, privilegios) {
    return menus.map((menu) => {
        // Crear una lista de submenús para el menú actual
        let menuSubMenus = subMenus
            .filter((subMenu) => subMenu.idMenu === menu.idMenu)
            .map((subMenu) => {
                // Crear una lista de privilegios para el submenú actual
                let subMenuPrivilegios = privilegios
                    .filter((privilegio) => privilegio.idSubMenu === subMenu.idSubMenu && privilegio.idMenu === menu.idMenu)
                    .map((privilegio) => ({
                        estado: privilegio.estado,
                        idMenu: privilegio.idMenu,
                        idPrivilegio: privilegio.idPrivilegio,
                        idSubMenu: privilegio.idSubMenu,
                        nombre: privilegio.nombre,
                    }));

                return {
                    estado: subMenu.estado,
                    idMenu: subMenu.idMenu,
                    idSubMenu: subMenu.idSubMenu,
                    nombre: subMenu.nombre,
                    ruta: subMenu.ruta,
                    icon: subMenu.icon,
                    privilegios: subMenuPrivilegios,
                };
            });

        return {
            ...menu,
            subMenus: menuSubMenus,
        };
    });
}

module.exports = {
    getUser,
    validateUserAccess,
    getPermisosByPerfil,
    generateMenus
};
