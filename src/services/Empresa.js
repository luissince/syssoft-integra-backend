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
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

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

            const bucket = firebaseService.getBucket();
            let respuesta = null;
            if (bucket) {
                respuesta = {
                    ...primeraEmpresa,
                    rutaLogo: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${primeraEmpresa.rutaLogo}`,
                    rutaImage: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${primeraEmpresa.rutaImage}`
                };
            } else {
                respuesta = {
                    ...primeraEmpresa,
                    rutaLogo: null,
                    rutaImage: null
                };
            }

            return sendSuccess(res, respuesta);
        } catch (error) {
            sendError(res, error.message || "Se produjo un error de servidor, intente nuevamente.", "Empresa/load", error);
        }
    }

    async id(req, res) {
        try {
            const [empresa] = await conec.query(`
            SELECT  
                idEmpresa,
                documento,
                razonSocial,
                nombreEmpresa,
                email,
                paginaWeb,
                rutaLogo,
                rutaImage,
                rutaIcon,
                usuarioEmail,
                claveEmail,
                usuarioSolSunat,
                claveSolSunat,
                certificadoSunat,
                claveCertificadoSunat,
                idApiSunat,
                claveApiSunat,
                numeroWhatsapp,
                tituloWhatsapp,
                mensajeWhatsapp,
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

            const bucket = firebaseService.getBucket();
            let respuesta = null;
            if (bucket) {
                respuesta = {
                    ...empresa,
                    rutaLogo: {
                        nombre: empresa.rutaLogo,
                        url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa.rutaLogo}`,
                    },
                    rutaImage: {
                        nombre: empresa.rutaImage,
                        url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa.rutaImage}`
                    },
                    rutaIcon: {
                        nombre: empresa.rutaIcon,
                        url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa.rutaIcon}`
                    }
                };
            } else {
                respuesta = {
                    ...empresa,
                    rutaLogo: null,
                    rutaImage: null,
                    rutaIcon: null,
                };
            }

            return sendSuccess(res, respuesta)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/id", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const bucket = firebaseService.getBucket();

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
                rutaIcon,
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

            let rutaLogo = null;
            let rutaImage = null;
            let rutaIcon = null;

            if (req.body.logo && req.body.logo.nombre === undefined && req.body.logo.base64 === undefined) {
                if (bucket) {
                    const file = bucket.file(empresa[0].rutaLogo);
                    await file.delete();
                }
            }
            else if (req.body.logo && req.body.logo.base64 !== undefined) {
                if (bucket) {
                    if (empresa[0].rutaLogo) {
                        const file = bucket.file(empresa[0].rutaLogo);
                        if (file.exists()) {
                            await file.delete();
                        }
                    }

                    const buffer = Buffer.from(req.body.logo.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `${timestamp}_${uniqueId}.${req.body.logo.extension}`;

                    const folderName = req.body.documento;
                    const filePath = `${folderName}/${fileName}`;

                    const file = bucket.file(filePath);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + req.body.logo.extension,
                        }
                    });
                    await file.makePublic();
                    rutaLogo = filePath;
                }
            } else {
                rutaLogo = req.body.logo.nombre;
            }

            if (req.body.image && req.body.image.nombre === undefined && req.body.image.base64 === undefined) {
                if (bucket) {
                    const file = bucket.file(empresa[0].rutaImage);
                    await file.delete();
                }
            }
            else if (req.body.image && req.body.image.base64 !== undefined) {
                if (bucket) {
                    if (empresa[0].rutaImage) {
                        const file = bucket.file(empresa[0].rutaImage);
                        if (file.exists()) {
                            await file.delete();
                        }
                    }

                    const buffer = Buffer.from(req.body.image.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `${timestamp}_${uniqueId}.${req.body.image.extension}`;

                    const folderName = req.body.documento;
                    const filePath = `${folderName}/${fileName}`;

                    const file = bucket.file(filePath);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + req.body.image.extension,
                        }
                    });
                    await file.makePublic();
                    rutaImage = filePath;
                }
            } else {
                rutaImage = req.body.image.nombre;
            }

            if (req.body.icon && req.body.icon.nombre === undefined && req.body.icon.base64 === undefined) {
                if (bucket) {
                    const file = bucket.file(empresa[0].rutaIcon);
                    await file.delete();
                }
            }
            else if (req.body.icon && req.body.icon.base64 !== undefined) {
                if (bucket) {
                    if (empresa[0].rutaIcon) {
                        const file = bucket.file(empresa[0].rutaIcon);
                        if (file.exists()) {
                            await file.delete();
                        }
                    }

                    const buffer = Buffer.from(req.body.icon.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `${timestamp}_${uniqueId}.${req.body.icon.extension}`;

                    const folderName = req.body.documento;
                    const filePath = `${folderName}/${fileName}`;

                    const file = bucket.file(filePath);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + req.body.icon.extension,
                        }
                    });
                    await file.makePublic();
                    rutaIcon = filePath;
                }
            } else {
                rutaIcon = req.body.icon.nombre;
            }

            // const rutaLogo = await processImage(
            //     fileCompany,
            //     req.body.logo,
            //     req.body.extlogo,
            //     empresa[0].rutaLogo
            // );
            // const rutaImage = await processImage(
            //     fileCompany,
            //     req.body.image,
            //     req.body.extimage,
            //     empresa[0].rutaImage
            // );

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
                rutaIcon=?,

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

                numeroWhatsapp=?,
                tituloWhatsapp=?,
                mensajeWhatsapp=?,
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
                rutaIcon,

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

                req.body.numeroWhatsapp,
                req.body.tituloWhatsapp,
                req.body.mensajeWhatsapp,
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
            const bucket = firebaseService.getBucket();

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
                rutaLogo: result.rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result.rutaLogo}` : null,
                rutaImage: result.rutaImage ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result.rutaImage}` : null,
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

    async getCompanyInfo(req, res) {
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

    async getCompanyWhatsApp(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                numeroWhatsapp,
                tituloWhatsapp,
                mensajeWhatsapp
            FROM 
                empresa
            LIMIT 
                1`);

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/loadForWeb", error);
        }
    }

    async getCompanyImages(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                nombreEmpresa,
                rutaImage,
                rutaIcon
            FROM 
                empresa
            LIMIT 
                1`);

            const bucket = firebaseService.getBucket();

            if (bucket) {
                result[0].rutaImage = result[0].rutaImage ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].rutaImage}` : null;
                result[0].rutaIcon = result[0].rutaIcon ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].rutaIcon}` : null;
            }

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/loadForWeb", error);
        }
    }
}

module.exports = new Empresa();