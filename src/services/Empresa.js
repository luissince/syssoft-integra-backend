const {
    sendSuccess,
    sendClient,
    sendError,
} = require('../tools/Message');
const {
    currentDate,
    currentTime,
    isDirectory,
    writeFile,
    mkdir,
    chmod,
    processImage,
    generateAlphanumericCode
} = require('../tools/Tools');
const path = require("path");
const Conexion = require('../database/Conexion');
const conec = new Conexion();

require('dotenv').config();

class Empresa {

    async infoEmpresaReporte(req) {
        try {

            let empresa = await conec.query(`SELECT 
                e.idEmpresa,
                e.nombreEmpresa,
                e.documento as ruc,
                e.razonSocial as nombreEmpresa,
                u.departamento,
                u.distrito,
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
            const [primeraEmpresa] = await conec.query(`
                SELECT
                    idEmpresa,
                    documento,
                    razonSocial,
                    nombreEmpresa,
                    rutaLogo,
                    rutaImage,
                    usuarioSolSunat,
                    claveSolSunat
                FROM 
                    empresa 
                LIMIT 1`);

            if (!primeraEmpresa) {
                throw new Error('No se encontraron datos de empresa.');
            }

            const respuesta = {
                ...primeraEmpresa,
                rutaLogo: !primeraEmpresa.rutaLogo ? null : `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaLogo}`,
                rutaImage: !primeraEmpresa.rutaImage ? null : `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaImage}`
            };

            return sendSuccess(res, respuesta);
        } catch (error) {
            sendError(res, error.message || "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            const [primeraEmpresa] = await conec.query(`SELECT  
                idEmpresa,
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                rutaImage,
                usuarioEmail,
                claveEmail,
                usuarioSolSunat,
                claveSolSunat,
                idApiSunat,
                claveApiSunat
            FROM 
                empresa
            WHERE 
                idEmpresa = ?`, [
                req.query.idEmpresa
            ]);

            const respuesta = {
                ...primeraEmpresa,
                rutaLogo: !primeraEmpresa.rutaLogo ? null : `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaLogo}`,
                rutaImage: !primeraEmpresa.rutaImage ? null : `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaImage}`
            };

            return sendSuccess(res, respuesta)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const fileDirectory = path.join(__dirname, '..', 'path', 'company');
            const exists = await isDirectory(fileDirectory);

            if (!exists) {
                await mkdir(fileDirectory);
                await chmod(fileDirectory);
            }

            const empresa = await conec.execute(connection, `
            SELECT
                rutaLogo,
                rutaImage
            FROM 
                empresa
            WHERE 
                idEmpresa  = ?`, [
                req.body.idEmpresa
            ]);

            const rutaLogo = await processImage(fileDirectory, req.body.logo, req.body.extlogo, empresa[0].rutaLogo);
            const rutaImage = await processImage(fileDirectory, req.body.image, req.body.extimage, empresa[0].rutaImage);

            await conec.execute(connection, `UPDATE empresa SET 
            documento = ?,
            razonSocial = ?,
            nombreEmpresa = ?,

            rutaLogo=?,
            rutaImage=?,

            usuarioEmail=?,
            claveEmail=?,

            usuarioSolSunat=?,
            claveSolSunat=?,
            idApiSunat=?,
            claveApiSunat=?,

            fupdate= ?,
            hupdate=?,
            idUsuario=?
            WHERE idEmpresa =?`, [
                req.body.documento,
                req.body.razonSocial,
                req.body.nombreEmpresa,

                rutaLogo,
                rutaImage,

                req.body.usuarioEmail,
                req.body.claveEmail,

                req.body.usuarioSolSunat,
                req.body.claveSolSunat,
                req.body.idApiSunat,
                req.body.claveApiSunat,

                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idEmpresa
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se actualizó correctamente los datos de la empresa.");
        } catch (error) {

            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async config(req, res) {
        try {
            const result = await conec.query(`SELECT 
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

            const empresa = await conec.execute(connection, `SELECT * FROM empresa`);
            if (empresa.length > 0) {
                await conec.rollback(connection);
                return sendSuccess(res, "Ya existe una empresa registrada.");
            }

            const listaEmpresa = await conec.execute(connection, 'SELECT idEmpresa FROM empresa');
            const idEmpresa = generateAlphanumericCode("EM0001", listaEmpresa, 'idEmpresa');

            const file = path.join(__dirname, '../', 'path/company');
            if (!isDirectory(file)) {
                mkdir(file);
                chmod(file);
            }

            let fileLogo = "";
            let fileImage = "";

            if (req.body.logo !== "") {
                const nameImage = `${Date.now() + 'logo'}.${req.body.extlogo}`;

                writeFile(path.join(file, nameImage), req.body.logo)
                fileLogo = nameImage;
            }

            if (req.body.image !== "") {
                const nameImage = `${Date.now() + 'image'}.${req.body.extimage}`;

                writeFile(path.join(file, nameImage), req.body.image);
                fileImage = nameImage;
            }

            await conec.execute(connection, `INSERT INTO empresa(
                idEmpresa,
                idTipoDocumento,
                documento,
                razonSocial,
                nombreEmpresa,
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
            ) VALUES(?,?,?,?,,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idEmpresa,
                'TD0003',
                req.body.documento,
                req.body.razonSocial,
                req.body.nombreEmpresa,
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