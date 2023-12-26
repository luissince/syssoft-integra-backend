const {
    sendSuccess,
    sendClient,
    sendError,
} = require('../tools/Message');
const {
    currentDate,
    currentTime,
    isDirectory,
    removeFile,
    writeFile,
    mkdir,
    chmod,
} = require('../tools/Tools');
const path = require("path");
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Empresa {

    async infoEmpresaReporte(req) {
        try {

            let empresa = await conec.query(`SELECT 
                e.idEmpresa,
                e.nombreEmpresa,
                e.celular,
                e.telefono,
                e.email,
                e.web,
                e.documento as ruc,
                e.razonSocial as nombreEmpresa,
                u.departamento,
                u.distrito,
                e.direccion,
                e.rutaLogo,
                e.rutaImage,
                e.usuarioEmail,
                e.claveEmail
                FROM empresa AS e
                LEFT JOIN ubigeo AS u ON e.idUbigeo  = u.idUbigeo 
                LIMIT 1`);

            let sucursal = await conec.query(`SELECT 
                idSucursal,
                nombre AS nombreSucursal
                FROM sucursal
                WHERE idSucursal = ?`, [
                req.query.idSucursal,
            ]);
            
            let result = [...empresa, ...sucursal];

            if (result.length >= 1) {
                return {
                    ...result[0],
                    ...result[1],
                }
            } else {
                return "Datos no encontrados";
            }
        } catch (error) {
            return 'Error interno de conexión, intente nuevamente.';
        }
    }

    async load(req, res) {
        try {
            let empresa = await conec.query(`SELECT
            idEmpresa ,
            documento,
            razonSocial,
            nombreEmpresa,
            direccion,
            rutaLogo,
            rutaImage,
            useSol,
            claveSol
            FROM empresa LIMIT 1`);

            if (empresa.length > 0) {
                return sendSuccess(res, empresa[0])
            } else {
                return sendClient(res, "Datos no encontrados.");
            }
        } catch (error) {
            sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

    async id(req, res) {
        try {
            let empresa = await conec.query(`SELECT  
            idEmpresa,
            documento,
            razonSocial,
            nombreEmpresa,
            direccion,
            rutaLogo,
            rutaImage,
            usuarioEmail,
            claveEmail,
            useSol,
            claveSol
            FROM empresa
            WHERE idEmpresa = ?`, [
                req.query.idEmpresa
            ]);

            if (empresa.length > 0) {
                return sendSuccess(res, empresa[0])
            } else {
                return sendClient(res, "Datos no encontrados.");
            }
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let file = path.join(__dirname, '../', 'path/company');

            if (!isDirectory(file)) {
                mkdir(file);
                chmod(file);
            }

            let empresa = await conec.execute(connection, `SELECT
            logo, 
            image,
            extlogo,
            extimage,
            rutaLogo,
            rutaImage
            FROM empresa
            WHERE idEmpresa  = ?`, [
                req.body.idEmpresa
            ]);

            let fileLogo = "";
            let extLogo = "";
            let rutaLogo = "";
            if (req.body.logo !== "") {
                removeFile(path.join(file, empresa[0].rutaLogo));

                let nameImage = `${Date.now() + req.body.idEmpresa}.${req.body.extlogo}`;
                writeFile(path.join(file, nameImage), req.body.logo);

                fileLogo = req.body.logo;
                extLogo = req.body.extlogo;
                rutaLogo = nameImage;
            } else {
                fileLogo = empresa[0].logo;
                extLogo = empresa[0].extlogo;
                rutaLogo = empresa[0].rutaLogo;
            }

            let fileImage = "";
            let extImage = "";
            let rutaImage = "";
            if (req.body.image !== "") {
                removeFile(path.join(file, empresa[0].rutaImage));

                let nameImage = `${Date.now() + req.body.idEmpresa}.${req.body.extimage}`;
                writeFile(path.join(file, nameImage), req.body.image);

                fileImage = req.body.image;
                extImage = req.body.extimage;
                rutaImage = nameImage;
            } else {
                fileImage = empresa[0].image;
                extImage = empresa[0].extimage;
                rutaImage = empresa[0].rutaImage;
            }
            
            await conec.execute(connection, `UPDATE empresa SET 
            documento = ?,
            razonSocial = ?,
            nombreEmpresa = ?,
            direccion=?,

            logo=?,
            image=?,
            extlogo=?,
            extimage=?,
            rutaLogo=?,
            rutaImage=?,

            usuarioEmail=?,
            claveEmail=?,

            useSol=?,
            claveSol=?,
            fupdate= ?,
            hupdate=?
            WHERE idEmpresa =?`, [
                req.body.documento,
                req.body.razonSocial,
                req.body.nombreEmpresa,
                req.body.direccion,

                fileLogo,
                fileImage,
                extLogo,
                extImage,
                rutaLogo,
                rutaImage,

                req.body.usuarioEmail,
                req.body.claveEmail,

                req.body.useSol,
                req.body.claveSol,
                currentDate(),
                currentTime(),
                req.body.idEmpresa
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se actualizó correctamente la empresa.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async config(req, res) {
        try {
            let result = await conec.query(`SELECT 
            idEmpresa,
            documento,
            razonSocial,
            nombreEmpresa,
            rutaLogo,
            rutaImage
            FROM empresa LIMIT 1`);
            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, "Iniciar configuración.");
            }
        } catch (error) {         
            return sendClient(res, "Iniciar configuración.");
        }
    }

    async save(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let empresa = await conec.execute(connection, `SELECT * FROM empresa`);
            if (empresa.length > 0) {
                await conec.rollback(connection);
                return sendSuccess(res, "Ya existe una empresa registrada.");
            }

            let result = await conec.execute(connection, 'SELECT idEmpresa FROM empresa');
            let idEmpresa = "";
            if (result.length != 0) {

                let quitarValor = result.map(function (item) {
                    return parseInt(item.idEmpresa.replace("EM", ''));
                });

                let valorActual = Math.max(...quitarValor);
                let incremental = valorActual + 1;
                let codigoGenerado = "";
                if (incremental <= 9) {
                    codigoGenerado = 'EM000' + incremental;
                } else if (incremental >= 10 && incremental <= 99) {
                    codigoGenerado = 'EM00' + incremental;
                } else if (incremental >= 100 && incremental <= 999) {
                    codigoGenerado = 'EM0' + incremental;
                } else {
                    codigoGenerado = 'EM' + incremental;
                }

                idEmpresa = codigoGenerado;
            } else {
                idEmpresa = "EM0001";
            }

            let file = path.join(__dirname, '../', 'path/company');
            if (!isDirectory(file)) {
                mkdir(file);
                chmod(file);
            }

            let fileLogo = "";
            let fileImage = "";

            if (req.body.logo !== "") {
                let nameImage = `${Date.now() + 'logo'}.${req.body.extlogo}`;

                writeFile(path.join(file, nameImage), req.body.logo)
                fileLogo = nameImage;
            }

            if (req.body.image !== "") {
                let nameImage = `${Date.now() + 'image'}.${req.body.extimage}`;

                writeFile(path.join(file, nameImage), req.body.image);
                fileImage = nameImage;
            }

            await conec.execute(connection, `INSERT INTO empresa(
                idEmpresa,
                idTipoDocumento,
                documento,
                razonSocial,
                nombreEmpresa,
                telefono,
                celular,
                email,
                web,
                direccion,
                logo,
                image,
                extlogo,
                extimage,
                rutaLogo,
                rutaImage,
                usuarioEmail,
                claveEmail,
                useSol,
                claveSol,
                certificado,
                claveCert,
                fecha,
                hora,
                fupdate,
                hupdate
             ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idEmpresa,
                'TD0003',
                req.body.documento,
                req.body.razonSocial,
                req.body.nombreEmpresa,
                req.body.telefono,
                req.body.celular,
                req.body.email,
                req.body.web,
                req.body.direccion,
                req.body.logo,
                req.body.image,
                req.body.extlogo,
                req.body.extimage,
                fileLogo,
                fileImage,
                '',
                '',
                '',
                '',
                '',
                '',
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente la empresa.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query('SELECT idEmpresa, nombreEmpresa FROM empresa');
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

}

module.exports = new Empresa();