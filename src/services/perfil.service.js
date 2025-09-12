const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const { ClientError } = require('../tools/Error');

class Perfil {

    async list(data) {
        const lista = await conec.query(`
            SELECT 
                p.idPerfil,
                s.nombreEmpresa as empresa,
                p.descripcion,
                DATE_FORMAT(p.fecha,'%d/%m/%Y') as fecha,
                p.hora
            FROM 
                perfil AS p 
            INNER JOIN 
                empresa AS s ON s.idEmpresa = p.idEmpresa 
            WHERE 
                ? = 0
                OR
                ? = 1 and p.descripcion like concat(?,'%')
            LIMIT 
                ?,?`, [
            parseInt(data.opcion),

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

        const total = await conec.query(`SELECT COUNT(*) AS Total 
            FROM perfil AS p 
            INNER JOIN empresa AS s ON s.idEmpresa = p.idEmpresa 
            WHERE 
            ? = 0
            OR
            ? = 1 and p.descripcion like concat(?,'%')`, [
            parseInt(data.opcion),

            parseInt(data.opcion),
            data.buscar
        ]);

        return { "result": resultLista, "total": total[0].Total };
    }

    async add(data) {
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
                data.idEmpresa,
                data.descripcion,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                data.idUsuario,
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
            return "Se registró correctamente el perfil.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async id(idPerfil) {
        const result = await conec.query('SELECT * FROM perfil WHERE idPerfil  = ?', [
            idPerfil,
        ]);

        return result[0];
    }

    async update(data) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                perfil 
            SET 
                idEmpresa=?, 
                descripcion=?, 
                fecha=?, 
                hora=?, 
                idUsuario=? 
            WHERE 
                idPerfil=?`, [
                data.idEmpresa,
                data.descripcion,
                currentDate(),
                currentTime(),
                data.idUsuario,
                data.idPerfil
            ])

            await conec.commit(connection)
            return "Se actualizó correctamente el Perfil.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async remove(idPerfil) {
        let connection = null;
        try {
            // Iniciar la transacción
            connection = await conec.beginTransaction();

            // Verificar si el perfil está asociado a algún usuario
            const usuario = await conec.execute(connection, `SELECT * FROM usuario WHERE idPerfil = ?`, [
                idPerfil
            ]);

            if (usuario.length > 0) {
                throw new ClientError('No se puede eliminar el perfil, ya que esta ligada a un usuario.');
            }

            // Eliminar los registros en otras tablas relacionadas
            await conec.execute(connection, `DELETE FROM perfil WHERE idPerfil  = ?`, [idPerfil]);
            await conec.execute(connection, `DELETE FROM permisoMenu WHERE idPerfil  = ?`, [idPerfil]);
            await conec.execute(connection, `DELETE FROM permisoSubMenu WHERE idPerfil  = ?`, [idPerfil]);
            await conec.execute(connection, `DELETE FROM permisoPrivilegio WHERE idPerfil = ?`, [idPerfil]);

            // Confirmar la transacción
            await conec.commit(connection);

            return "Se eliminó correctamente el Perfil.";
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

    async combo() {
        const result = await conec.query('SELECT idPerfil,descripcion FROM perfil');
        return result;
    }
}

module.exports = new Perfil();
