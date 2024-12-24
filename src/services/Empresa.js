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
    generateAlphanumericCode,
    processFilePem,
    processFile
} = require('../tools/Tools');
const path = require("path");
const Conexion = require('../database/Conexion');
const conec = new Conexion();
require('dotenv').config();

class Empresa {

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
                LIMIT 
                    1`);

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
            sendError(res, error.message || "Se produjo un error de servidor, intente nuevamente.", "Empresa/load", error);
        }
    }

    async id(req, res) {
        try {
            const [primeraEmpresa] = await conec.query(`
            SELECT  
                idEmpresa,
                documento,
                razonSocial,
                nombreEmpresa,
                email,
                paginaWeb,
                rutaLogo,
                rutaImage,
                usuarioEmail,
                claveEmail,
                usuarioSolSunat,
                claveSolSunat,
                certificadoSunat,
                claveCertificadoSunat,
                idApiSunat,
                claveApiSunat,
                horarioAtencion,
                acercaNosotros,
                politicasPrivacidad,
                terminosCondiciones
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/id", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const fileCertificates = path.join(__dirname, '..', 'path', 'certificates');
            const existsCertificates = await isDirectory(fileCertificates);

            if (!existsCertificates) {
                await mkdir(fileCertificates);
                await chmod(fileCertificates);
            }

            const fileCompany = path.join(__dirname, '..', 'path', 'company');
            const existsCompany = await isDirectory(fileCompany);

            if (!existsCompany) {
                await mkdir(fileCompany);
                await chmod(fileCompany);
            }

            const empresa = await conec.execute(connection, `
            SELECT
                rutaLogo,
                rutaImage,
                certificadoSunat,
                certificadoPem,
                privatePem
            FROM 
                empresa
            WHERE 
                idEmpresa  = ?`, [
                req.body.idEmpresa
            ]);

            const rutaCertificado = await processFilePem(
                fileCertificates,
                req.body.certificado,
                req.body.documento,
                req.body.extCertificado,
                req.body.claveCertificado,
                empresa[0].certificadoSunat,
                empresa[0].certificadoPem,
                empresa[0].privatePem
            );

            await processFile(
                fileCertificates,
                req.body.fireBase,
                process.env.FIREBASE_FILE_ACCOUNT_NAME,
                req.body.extFireBase
            );

            const rutaLogo = await processImage(
                fileCompany,
                req.body.logo,
                req.body.extlogo,
                empresa[0].rutaLogo
            );
            const rutaImage = await processImage(
                fileCompany,
                req.body.image,
                req.body.extimage,
                empresa[0].rutaImage
            );

            await conec.execute(connection, `
            UPDATE 
                empresa 
            SET 
                documento = ?,
                razonSocial = ?,
                nombreEmpresa = ?,
                email = ?,
                paginaWeb = ?,

                rutaLogo=?,
                rutaImage=?,

                usuarioEmail=?,
                claveEmail=?,

                usuarioSolSunat=?,
                claveSolSunat=?,

                certificadoSunat=?,
                claveCertificadoSunat=?,
                certificadoPem=?,
                privatePem=?,

                idApiSunat=?,
                claveApiSunat=?,

                horarioAtencion=?,
                acercaNosotros=?,
                politicasPrivacidad=?,
                terminosCondiciones=?,

                fupdate= ?,
                hupdate=?,
                idUsuario=?
            WHERE 
                idEmpresa =?`, [
                req.body.documento,
                req.body.razonSocial,
                req.body.nombreEmpresa,
                req.body.email,
                req.body.paginaWeb,

                rutaLogo,
                rutaImage,

                req.body.usuarioEmail,
                req.body.claveEmail,

                req.body.usuarioSolSunat,
                req.body.claveSolSunat,

                rutaCertificado.nombre,
                req.body.claveCertificado,
                rutaCertificado.certificate,
                rutaCertificado.private,

                req.body.idApiSunat,
                req.body.claveApiSunat,

                req.body.horarioAtencion,
                req.body.acercaNosotros,
                req.body.politicasPrivacidad,
                req.body.terminosCondiciones,

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
            return sendError(res, error.message ?? "Se produjo un error en el servidor, intente nuevamente.", "Empresa/update", error);
        }
    }

    async config(req, res) {
        try {
            const [result] = await conec.query(`
            SELECT 
                idEmpresa,
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                rutaImage
            FROM 
                empresa 
            LIMIT 1`);

            const empresa = {
                ...result,
                rutaLogo: !result.rutaLogo ? null : `${process.env.APP_URL}/files/company/${result.rutaLogo}`,
                rutaImage: !result.rutaImage ? null : `${process.env.APP_URL}/files/company/${result.rutaImage}`
            }

            return sendSuccess(res, empresa);
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

            await conec.execute(connection, `
            INSERT INTO empresa(
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/save", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                idEmpresa,
                nombreEmpresa 
            FROM 
                empresa`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/combo", error);
        }
    }

    async loadForWeb(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                nombreEmpresa,
                email,
                paginaWeb,
                horarioAtencion,
                acercaNosotros,
                politicasPrivacidad,
                terminosCondiciones
            FROM 
                empresa
            LIMIT 
                1`);

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/loadForWeb", error);
        }
    }
}

module.exports = new Empresa();