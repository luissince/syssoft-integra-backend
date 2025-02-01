const Conexion = require('../database/Conexion');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { createToken } = require('../tools/Jwt');
const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { ClientError } = require('../tools/Error');
const conec = new Conexion();
require('dotenv').config();

class Usuario {

    async list(data) {
        const lista = await conec.query(`
            SELECT 
                u.idUsuario,
                u.dni,
                u.nombres,
                u.apellidos,
                u.telefono,
                u.email,
                u.representante,
                IFNULL(p.descripcion,'-') AS perfil,
                u.estado
            FROM 
                usuario AS u 
            LEFT JOIN 
                perfil AS p ON u.idPerfil  = p.idPerfil
            WHERE 
                    ? = 0
                OR
                    ? = 1 and u.nombres like concat(?,'%')
                OR
                    ? = 1 and u.apellidos like concat(?,'%')
                OR
                    ? = 1 and u.dni like concat(?,'%')
                LIMIT 
                    ?,?`, [
            parseInt(data.opcion),

            parseInt(data.opcion),
            data.buscar,

            parseInt(data.opcion),
            data.buscar,

            parseInt(data.opcion),
            data.buscar,

            parseInt(data.posicionPagina),
            parseInt(data.filasPorPagina)
        ])

        const resultLista = lista.map(function (item, index) {
            return {
                ...item,
                id: (index + 1) + parseInt(data.posicionPagina)
            }
        });

        const total = await conec.query(`
            SELECT 
                COUNT(*) AS Total 
            FROM 
                usuario AS u 
            LEFT JOIN 
                perfil AS p ON u.idPerfil  = p.idPerfil
            WHERE 
                    ? = 0
                OR
                    ? = 1 and u.nombres like concat(?,'%')
                OR
                    ? = 1 and u.apellidos like concat(?,'%')
                OR
                    ? = 1 and u.dni like concat(?,'%')`, [
            parseInt(data.opcion),

            parseInt(data.opcion),
            data.buscar,

            parseInt(data.opcion),
            data.buscar,

            parseInt(data.opcion),
            data.buscar,
        ]);

        return { "result": resultLista, "total": total[0].Total };
    }

    async add(data) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const resultUsuario = await conec.execute(connection, 'SELECT idUsuario FROM usuario');
            const idUsuario = generateAlphanumericCode("US0001", resultUsuario, 'idUsuario');

            let hash = "";
            if (data.activeLogin) {
                const salt = bcrypt.genSaltSync(saltRounds);
                hash = bcrypt.hashSync(data.clave, salt);

                let usuario = await conec.execute(connection, `
                    SELECT 
                        * 
                    FROM 
                        usuario
                    WHERE 
                        usuario = ?`, [
                    data.usuario,
                ]);

                if (usuario.length > 0) {
                    throw new ClientError("Hay un usuario con el mismo valor.");
                }
            }

            await conec.execute(connection, `
                INSERT INTO usuario(
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
                data.nombres,
                data.apellidos,
                data.dni,
                data.genero,
                data.direccion,
                data.telefono,
                data.email,
                data.idPerfil,
                data.representante,
                data.estado,
                data.activeLogin,
                data.usuario,
                hash,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
            ])

            await conec.commit(connection);
            return 'Los datos se registrarón correctamente.';
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            if (error instanceof ClientError) {
                throw error;  // No es necesario crear una nueva instancia de ClientError
            } else {
                // Lanzar el error tal cual si no es un ClientError
                throw error;
            }
        }
    }

    async update(data) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (data.activeLogin) {
                const usuario = await conec.execute(connection, `
                SELECT 
                    idUsuario 
                FROM 
                    usuario
                WHERE 
                    usuario = ? AND idUsuario <> ?`, [
                    data.usuario,
                    data.idUsuario
                ]);

                if (usuario.length > 0) {
                    throw new ClientError("El nombre de usuario '" + data.usuario + "' ya existe.");
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
                data.nombres,
                data.apellidos,
                data.dni,
                data.genero,
                data.direccion,
                data.telefono,
                data.email,
                data.idPerfil,
                data.representante,
                data.estado,
                data.activeLogin,
                data.usuario,
                currentDate(),
                currentTime(),
                data.idUsuario
            ])

            await conec.commit(connection)
            return "Se actualizó correctamente el usuario.";
        } catch (error) {
            // Revertir la transacción en caso de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            // Si el error es un ClientError, lo lanzamos directamente
            if (error instanceof ClientError) {
                throw error;  // No es necesario crear una nueva instancia de ClientError
            } else {
                // Lanzar el error tal cual si no es un ClientError
                throw error;
            }
        }
    }

    async remove(idUsuario) {
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
                    idUsuario
                ]);

                if (queryResult.length > 0) {
                    throw new ClientError(`No se puede eliminar el usuario ya que está ligado a ${table}.`);
                }
            }

            await conec.execute(connection, `DELETE FROM usuario WHERE idUsuario = ?`, [
                idUsuario
            ]);

            await conec.commit(connection);
            return "Se eliminó correctamente el usuario.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async reset(data) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const usuario = await conec.execute(connection, `SELECT * FROM usuario WHERE idUsuario = ? AND login = 0`, [
                data.idUsuario
            ]);

            if (usuario.length > 0) {
                throw new ClientError("El usuario no tiene cuenta para resetear su contraseña.");
            }

            const salt = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync(data.clave, salt);

            await conec.execute(connection, `
            UPDATE 
                usuario 
            SET
                clave = ?
            WHERE 
                idUsuario=?`, [
                hash,
                data.idUsuario
            ]);

            await conec.commit(connection)
            return "Se actualizó la contraseña correctamente.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            throw error;
        }
    }

    async id(idUsuario) {
        try {
            const result = await conec.query('SELECT * FROM usuario WHERE idUsuario  = ?', [
                idUsuario
            ]);

            if (result.length === 0) {
                throw new ClientError("Datos no encontrados");
            }

            return result[0];
        } catch (error) {
            if (error instanceof ClientError) {
                throw error;  // No es necesario crear una nueva instancia de ClientError
            } else {
                // Lanzar el error tal cual si no es un ClientError
                throw error;
            }       
        }
    }

    async combo() {
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
            return result;
        } catch (error) {
            throw error;
        }
    }

    async createSession(data) {
        try {
            const validate = await conec.query(`
                SELECT 
                    idUsuario, 
                    clave 
                FROM 
                    usuario 
                WHERE 
                    usuario = ?`, [
                data.usuario,
            ]);

            if (validate.length == 0) {
                throw new ClientError("Datos incorrectos, intente nuevamente.");
            }

            const hash = bcrypt.compareSync(data.password, validate[0].clave);
            if (!hash) {
                throw new ClientError("Datos incorrectos, intente nuevamente.");
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
                throw new ClientError("Su cuenta se encuentra inactiva.");
            }

            if (usuario[0].login === 0) {
                throw new ClientError("Su cuenta no tiene acceso al sistema.");
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

            const token = await createToken({
                ...user,
                idPerfil: usuario[0].idPerfil,
            }, process.env.TOKEN_ACCESSO);

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

            return {
                ...user,
                idPerfil: usuario[0].idPerfil,
                token,
                menus: this.generateMenus(menus, subMenus, privilegios)
            };
        } catch (error) {
            if (error instanceof ClientError) {
                throw error;  // No es necesario crear una nueva instancia de ClientError
            } else {
                // Lanzar el error tal cual si no es un ClientError
                throw error;
            }
        }
    }

    async validToken(idUsuario) {
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
                idUsuario
            ]);

            if (usuario[0].estado === 0) {
                throw new ClientError("Su cuenta se encuentra inactiva.");
            }

            if (usuario[0].login === 0) {
                throw new ClientError("Su cuenta no tiene acceso al sistema.");
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

            const token = await createToken({
                ...user,
                idPerfil: usuario[0].idPerfil,
            }, process.env.TOKEN_ACCESSO);

            return {
                ...user,
                idPerfil: usuario[0].idPerfil,
                token,
                menus: this.generateMenus(menus, subMenus, privilegios)
            };
        } catch (error) {
            if (error instanceof ClientError) {
                throw error;  // No es necesario crear una nueva instancia de ClientError
            } else {
                // Lanzar el error tal cual si no es un ClientError
                throw error;
            }
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