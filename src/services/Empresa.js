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
    generateAlphanumericCode,
    processFilePem,
    processFile,
    isFile,
    getCertificateDates,
    processFirebaseFile,
    generateFileData
} = require('../tools/Tools');
const path = require("path");
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');

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

            const respuesta = {
                ...primeraEmpresa,
                rutaLogo: bucket && primeraEmpresa.rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${primeraEmpresa.rutaLogo}` : null,
                rutaImage: bucket && primeraEmpresa.rutaImage ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${primeraEmpresa.rutaImage}` : null
            };

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
                rutaLogo,
                rutaImage,
                rutaIcon,
                rutaBanner,
                rutaPortada,
                usuarioSolSunat,
                claveSolSunat,
                certificadoSunat,
                claveCertificadoSunat,
                IFNULL(DATE_FORMAT(certificadoInicio, '%d/%m/%Y'), '') AS certificadoInicio,
                IFNULL(DATE_FORMAT(certificadoExpiracion, '%d/%m/%Y'), '') AS certificadoExpiracion,
                idApiSunat,
                claveApiSunat,
                numeroWhatsapp,
                tituloWhatsapp,
                mensajeWhatsapp,
                paginaWeb,
                youTubePagina,
                facebookPagina,
                twitterPagina,
                instagramPagina,
                tiktokPagina,
                informacion,
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
            const createFileData = (fileName) => (
                bucket && fileName
                    ? {
                        nombre: fileName,
                        url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${fileName}`
                    }
                    : null
            );

            const respuesta = {
                ...empresa,

                rutaLogo: createFileData(empresa.rutaLogo),
                rutaImage: createFileData(empresa.rutaImage),
                rutaIcon: createFileData(empresa.rutaIcon),
                rutaPortada: createFileData(empresa.rutaPortada),
                rutaBanner: createFileData(empresa.rutaBanner),
            };

            const serviceAccountKey = await isFile(path.join(__dirname, '..', 'path', 'certificates', 'serviceAccountKey.json'));

            if (serviceAccountKey) {
                respuesta.certificadoFirebase = "services.json"
            } else {
                respuesta.certificadoFirebase = null;
            }

            const banners = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    idBanner,
                    idEmpresa,
                    nombre,
                    ancho,
                    alto
                FROM 
                    empresaBanner 
                WHERE 
                    idEmpresa = ?`, [
                req.query.idEmpresa
            ]);

            const newBanners = [];

            if (bucket) {
                for (const banner of banners) {
                    newBanners.push({
                        "index": banner.id,
                        "idBanner": banner.idBanner,
                        "nombre": banner.nombre,
                        "url": `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${banner.nombre}`,
                        "remover": false
                    });
                }
            }

            respuesta.banners = newBanners;

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

            const empresa = await conec.execute(connection, `
            SELECT
                rutaLogo,
                rutaImage,
                rutaIcon,
                rutaBanner,
                rutaPortada,
                certificadoSunat,
                certificadoPem,
                privatePem,
                certificadoInicio,
                certificadoExpiracion
            FROM 
                empresa
            WHERE 
                idEmpresa  = ?`, [
                req.body.idEmpresa
            ]);

            const certificadoDates = getCertificateDates(empresa[0].certificadoPem);

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

            /**
             * Procesar archivo de firebase.
             */
            await processFile(
                fileCertificates,
                req.body.fireBase,
                process.env.FIREBASE_FILE_ACCOUNT_NAME,
                req.body.extFireBase
            );

            /**
             * Procesar imagen de logo
             */
            const rutaLogo = await processFirebaseFile(
                firebaseService,
                req.body.logo,
                empresa[0].rutaLogo,
                req.body.documento,
                "empresa"
            );

            /**
             * Procesar imagen de empresa
             */
            const rutaImage = await processFirebaseFile(
                firebaseService,
                req.body.image,
                empresa[0].rutaImage,
                req.body.documento,
                "empresa"
            );

            /**
             * Procesar icono de empresa
             */
            const rutaIcon = await processFirebaseFile(
                firebaseService,
                req.body.icon,
                empresa[0].rutaIcon,
                req.body.documento,
                "empresa"
            );

            /**
             * Procesar banner de empresa
             */
            const rutaBanner = await processFirebaseFile(
                firebaseService,
                req.body.banner,
                empresa[0].rutaBanner,
                req.body.documento,
                "empresa"
            );

            // Procesar portada de empresa
            const rutaPortada = await processFirebaseFile(
                firebaseService,
                req.body.portada,
                empresa[0].rutaPortada,
                req.body.documento,
                "empresa"
            );

            // Proceso para validar los banners existentes y si se debe eliminar o actualizar
            const banners = req.body.banners;

            const cacheBanners = await conec.execute(connection, `
                SELECT 
                    idBanner,
                    idEmpresa,
                    nombre,
                    extension,
                    ancho,
                    alto
                FROM
                    empresaBanner
                WHERE
                    idEmpresa = ?`, [
                req.body.idEmpresa
            ]);

            await conec.execute(connection, `DELETE FROM empresaBanner WHERE idEmpresa = ?`, [
                req.body.idEmpresa
            ]);

            /**
             * Procesar banners de empresa.
             */
            let idBanner = 0;
            for (const banner of banners) {
                /**
                 * =====================================================
                 * ELIMINAR
                 * =====================================================
                 */
                if (banner.remover !== undefined && banner.remover === true) {
                    await firebaseService.deleteFile(banner.nombre);
                    continue;
                }

                /**
                 * =====================================================
                 * NUEVO BANNER
                 * =====================================================
                 */
                if (banner.base64 !== undefined) {
                    /**
                     * Generar información del archivo.
                     */
                    const { buffer, filePath } = generateFileData(banner.base64, banner.extension, req.body.documento, "banner");

                    /**
                     * Subir archivo.
                     */
                    await firebaseService.uploadFile(filePath, buffer, 'image/' + banner.extension);

                    /**
                     * Insertar nuevo banner.
                     */
                    idBanner++;
                    await conec.execute(connection, `
                    INSERT INTO empresaBanner(
                        idBanner,
                        idEmpresa,
                        nombre,
                        extension,
                        ancho,
                        alto
                    ) VALUES(?,?,?,?,?,?)`, [
                        idBanner,
                        req.body.idEmpresa,
                        filePath,
                        banner.extension,
                        banner.width,
                        banner.height,
                    ]);

                    continue;
                }

                /**
                 * =====================================================
                 * BANNER EXISTENTE
                 * =====================================================
                 */
                const imageOld = cacheBanners.find((item) => item.idBanner === banner.idBanner);

                /**
                 * Validar existencia.
                 */
                if (!imageOld) {
                    continue;
                }

                /**
                 * Mantener banner actual.
                 */
                idBanner++;
                await conec.execute(connection, `
                INSERT INTO empresaBanner(
                    idBanner,
                    idEmpresa,
                    nombre,
                    extension,
                    ancho,
                    alto
                ) VALUES(?,?,?,?,?,?)`, [
                    idBanner,
                    req.body.idEmpresa,
                    imageOld.nombre,
                    imageOld.extension,
                    imageOld.ancho,
                    imageOld.alto,
                ]);
            }

            // Actualizar informacion de empresa
            await conec.execute(connection, `
            UPDATE 
                empresa 
            SET 
                documento = ?,
                razonSocial = ?,
                nombreEmpresa = ?,
                email = ?,

                rutaLogo=?,
                rutaImage=?,
                rutaIcon=?,
                rutaPortada=?,
                rutaBanner=?,

                usuarioSolSunat=?,
                claveSolSunat=?,

                certificadoSunat=?,
                claveCertificadoSunat=?,
                certificadoPem=?,
                privatePem=?,
                certificadoInicio=?,
                certificadoExpiracion=?,

                idApiSunat=?,
                claveApiSunat=?,

                numeroWhatsapp=?,
                tituloWhatsapp=?,
                mensajeWhatsapp=?,

                paginaWeb = ?,
                youTubePagina = ?,
                facebookPagina = ?,
                twitterPagina = ?,
                instagramPagina = ?,
                tiktokPagina = ?,

                informacion=?,
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

                rutaLogo,
                rutaImage,
                rutaIcon,
                rutaPortada,
                rutaBanner,

                req.body.usuarioSolSunat,
                req.body.claveSolSunat,

                rutaCertificado.nombre,
                req.body.claveCertificado,
                rutaCertificado.certificate,
                rutaCertificado.private,
                certificadoDates.startDateTime
                ?? rutaCertificado.startDateTime
                ?? empresa[0].certificadoInicio
                ?? null,
                certificadoDates.expirationDateTime
                ?? rutaCertificado.expirationDateTime
                ?? empresa[0].certificadoExpiracion
                ?? null,

                req.body.idApiSunat,
                req.body.claveApiSunat,

                req.body.numeroWhatsapp,
                req.body.tituloWhatsapp,
                req.body.mensajeWhatsapp,

                req.body.paginaWeb,
                req.body.youTubePagina,
                req.body.facebookPagina,
                req.body.twitterPagina,
                req.body.instagramPagina,
                req.body.tiktokPagina,

                req.body.informacion,
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
                rutaLogo: bucket && result.rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result.rutaLogo}` : null,
                rutaImage: bucket && result.rutaImage ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result.rutaImage}` : null,
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
                useSol,
                claveSol,
                certificado,
                claveCert,
                fecha,
                hora,
                fupdate,
                hupdate
            ) VALUES(?,?,?,?,,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
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
                idEmpresa,
                nombreEmpresa,
                email,
                paginaWeb,
                youTubePagina,
                facebookPagina,
                twitterPagina,
                instagramPagina,
                tiktokPagina,
                informacion,
                acercaNosotros,
                politicasPrivacidad,
                terminosCondiciones,
                rutaImage,
                rutaIcon,
                rutaPortada,
                rutaBanner
            FROM 
                empresa
            LIMIT 
                1`);

            const bucket = firebaseService.getBucket();

            if (bucket) {
                result[0].rutaImage = result[0].rutaImage ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].rutaImage}` : null;
                result[0].rutaIcon = result[0].rutaIcon ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].rutaIcon}` : null;
                result[0].rutaPortada = result[0].rutaPortada ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].rutaPortada}` : null;
                result[0].rutaBanner = result[0].rutaBanner ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].rutaBanner}` : null;
            }

            const banners = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    idBanner,
                    idEmpresa,
                    nombre,
                    ancho,
                    alto
                FROM 
                    empresaBanner 
                WHERE 
                    idEmpresa = ?`, [
                result[0].idEmpresa
            ]);

            const newBanners = [];

            if (bucket) {
                for (const banner of banners) {
                    newBanners.push({
                        "id": banner.id,
                        "nombre": banner.nombre,
                        "url": `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${banner.nombre}`,
                        "ancho": banner.ancho,
                        "alto": banner.alto,
                    });
                }
            }

            result[0].banners = newBanners;

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/loadForWeb", error);
        }
    }

    async getCompanyBanners(req, res) {
        try {
            const result = await conec.query(`
            SELECT
                idEmpresa
            FROM 
                empresa
            LIMIT 
                1`);

            const banners = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    idBanner,
                    idEmpresa,
                    nombre,
                    ancho,
                    alto
                FROM 
                    empresaBanner 
                WHERE 
                    idEmpresa = ?`, [
                result[0].idEmpresa
            ]);

            const newBanners = [];

            const bucket = firebaseService.getBucket();
            if (bucket) {
                for (const banner of banners) {
                    newBanners.push({
                        "id": banner.id,
                        "nombre": banner.nombre,
                        "url": `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${banner.nombre}`,
                        "ancho": banner.ancho,
                        "alto": banner.alto,
                    });
                }
            }

            return sendSuccess(res, newBanners);
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
}

module.exports = new Empresa();