const Conexion = require('../database/Conexion');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { create } = require('../tools/Jwt');
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/list", error);
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/add", error);
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
                    return sendClient(res, "El nombre de usuario '" + req.body.usuario + "' ya existe.");
                }
            }

            await conec.execute(connection, `
            UPDATE 
                usuario 
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/update", error);
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/delete", error);
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/reset", error);
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/id", error);
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Usuario/combo", error);
        }
    }

    async createSession(req, res) {
        try {
            const validate = await conec.query(`
                SELECT 
                    idUsuario, 
                    clave 
                FROM 
                    usuario 
                WHERE 
                    usuario = ?`, [
                req.query.usuario,
            ]);

            if (validate.length == 0) {
                return sendClient(res, "Datos incorrectos, intente nuevamente.");
            }

            const hash = bcrypt.compareSync(req.query.password, validate[0].clave);
            if (!hash) {
                return sendClient(res, "Datos incorrectos, intente nuevamente.");
            }

            const usuario = await conec.query(`
                SELECT 
                    u.idUsuario, 
                    u.nombres,
                    u.apellidos,
                    u.idPerfil,
                    u.estado,
                    u.login,
                    p.descripcion AS rol
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
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
                FROM 
                    permisoMenu as pm 
                INNER JOIN 
                    perfil as p on pm.idPerfil = p.idPerfil
                INNER JOIN 
                    menu as m on pm.idMenu = m.idMenu
                WHERE 
                    p.idPerfil = ?`, [
                usuario[0].idPerfil,
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
                    permisoSubMenu as psm
                INNER JOIN 
                    perfil AS p ON psm.idPerfil = p.idPerfil
                INNER JOIN 
                    subMenu AS sm on sm.idMenu = psm.idMenu and sm.idSubMenu = psm.idSubMenu
                WHERE 
                    psm.idPerfil = ?
                ORDER BY 
                    idSubMenu`, [
                usuario[0].idPerfil,
            ]);

            const privilegios = await conec.query(`
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
                usuario[0].idPerfil,
            ]);

            const token = await create(user, 'userkeylogin');

            // const connection = await amqp.connect({
            //     protocol: 'amqp',
            //     hostname: 'localhost', // Usa una variable de entorno o un valor por defecto
            //     port: 5672,
            //     username: 'user',
            //     password: 'password',
            //     vhost: '/',
            //     connectionTimeout: 10000,
            // });
            // const channel = await connection.createChannel();
            // channel.assertQueue('facturas_por_declarar', { durable: true });
            // channel.assertQueue('facturas_por_declarar', Buffer.from(JSON.stringify({ facturaId: 12345 })));

            return sendSuccess(res, {
                ...user,
                idPerfil: usuario[0].idPerfil,
                token,
                menus: this.generateMenus(menus, subMenus, privilegios)
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Login/createSession", error);
        }
    }

    async validToken(req, res) {
        try {
            const usuario = await conec.query(`
                SELECT 
                    u.idUsuario, 
                    u.nombres,
                    u.apellidos,
                    u.idPerfil,
                    u.estado,
                    u.login,
                    p.descripcion AS rol
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                req.idUsuario
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
                FROM 
                    permisoMenu as pm 
                INNER JOIN 
                    perfil as p on pm.idPerfil = p.idPerfil
                INNER JOIN 
                    menu as m on pm.idMenu = m.idMenu
                WHERE 
                    p.idPerfil = ?`, [
                usuario[0].idPerfil,
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
                    permisoSubMenu as psm
                INNER JOIN 
                    perfil AS p ON psm.idPerfil = p.idPerfil
                INNER JOIN 
                    subMenu AS sm on sm.idMenu = psm.idMenu and sm.idSubMenu = psm.idSubMenu
                WHERE 
                    psm.idPerfil = ?
                ORDER BY 
                    idSubMenu`, [
                usuario[0].idPerfil,
            ]);

            const privilegios = await conec.query(`
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
                usuario[0].idPerfil,
            ]);

            const token = await create(user, 'userkeylogin');

            return sendSuccess(res, {
                ...user,
                idPerfil: usuario[0].idPerfil,
                token,
                menus: this.generateMenus(menus, subMenus, privilegios)
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Login/validateToken", error);
        }
    }

    generateMenus(menus, subMenus, privilegios) {
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
}

module.exports = new Usuario();