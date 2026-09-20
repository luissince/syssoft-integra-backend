const {
    sendSuccess,
    sendError,
} = require('../tools/Message');
const {
    currentDate,
    currentTime,
    processFilePem,
    processFirebaseFile,
    generateFileData
} = require('../tools/Tools');
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

            const respuesta = {
                ...primeraEmpresa,
                rutaLogo: firebaseService.getUrl(primeraEmpresa.rutaLogo),
                rutaImage: firebaseService.getUrl(primeraEmpresa.rutaImage),
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

                usuarioSolSunat,
                claveSolSunat,
                certificadoSunat,
                claveCertificadoSunat,
                IFNULL(DATE_FORMAT(certificadoInicio, '%d/%m/%Y'), '') AS certificadoInicio,
                IFNULL(DATE_FORMAT(certificadoExpiracion, '%d/%m/%Y'), '') AS certificadoExpiracion,
                idApiSunat,
                claveApiSunat,
                notaSunat,
                tipoEnvio,

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

            const createFileData = (fileName) => {
                const url = firebaseService.getUrl(fileName);

                if(!url){
                    return null;
                }

                return {
                    nombre: fileName,
                    url: firebaseService.getUrl(fileName)
                }
            };

            const respuesta = {
                ...empresa,
                certificadoSunat: createFileData(empresa.certificadoSunat),
                rutaLogo: createFileData(empresa.rutaLogo),
                rutaImage: createFileData(empresa.rutaImage),
                rutaIcon: createFileData(empresa.rutaIcon),
            };

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

            respuesta.banners = banners.map((banner) => {
                return {
                    "index": banner.id,
                    "idBanner": banner.idBanner,
                    "nombre": banner.nombre,
                    "url": firebaseService.getUrl(banner.nombre),
                    "remover": false
                }
            });

            return sendSuccess(res, respuesta)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/id", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            const empresa = await conec.execute(connection, `
            SELECT
                rutaLogo,
                rutaImage,
                rutaIcon,

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

            /**
             * Procesar archivo del certificado de sunat.
             */
            const processCertificado = await processFilePem(
                req.body.certificado,
                req.body.documento,
                req.body.claveCertificado,
                empresa[0].certificadoSunat,
                empresa[0].certificadoPem,
                empresa[0].privatePem
            );

            const rutaCertificado = await processFirebaseFile(
                firebaseService,
                req.body.certificado,
                empresa[0].certificadoSunat,
                req.body.documento,
                "empresa"
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

                notaSunat=?,

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

                req.body.usuarioSolSunat,
                req.body.claveSolSunat,

                rutaCertificado,
                req.body.claveCertificado,
                processCertificado.certificadoPem,
                processCertificado.privatePem,
                processCertificado.startDateTime ?? empresa[0].certificadoInicio ?? null,
                processCertificado.expirationDateTime ?? empresa[0].certificadoExpiracion ?? null,

                req.body.idApiSunat,
                req.body.claveApiSunat,

                req.body.notaSunat,

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

                date,
                time,
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
                paginaWeb,
                rutaLogo,
                rutaImage
            FROM 
                empresa 
            LIMIT 1`);

            const empresa = {
                ...result,
                rutaLogo: firebaseService.getUrl(result.rutaLogo),
                rutaImage: firebaseService.getUrl(result.rutaImage),
            }

            return sendSuccess(res, empresa);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Empresa/config", error);
        }
    }

    async save(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const empresa = await conec.execute(connection, `SELECT * FROM empresa LIMIT 1`);
            if (empresa.length > 0) {
                await conec.rollback(connection);
                return sendSuccess(res, "Ya existe una empresa registrada.");
            }


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
                rutaIcon
            FROM 
                empresa
            LIMIT 
                1`);

            result[0].rutaImage = firebaseService.getUrl(result[0].rutaImage);
            result[0].rutaIcon = firebaseService.getUrl(result[0].rutaIcon);

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

            const newBanners = banners.map((banner) => {
                return {
                    "id": banner.id,
                    "nombre": banner.nombre,
                    "url": firebaseService.getUrl(banner.nombre),
                    "ancho": banner.ancho,
                    "alto": banner.alto,
                }
            });

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

            const newBanners = banners.map((banner) => {
                return {
                    "id": banner.id,
                    "nombre": banner.nombre,
                    "url": firebaseService.getUrl(banner.nombre),
                    "ancho": banner.ancho,
                    "alto": banner.alto,
                }
            });

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