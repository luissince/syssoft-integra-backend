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
                    rutaImage
                FROM 
                    empresa 
                LIMIT 1`);

            if (!primeraEmpresa) {
                throw new Error('No se encontraron datos de empresa.');
            }

            const respuesta = {
                ...primeraEmpresa,
                rutaLogo: `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaLogo}`,
                rutaImage: `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaImage}`
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
                rutaLogo: `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaLogo}`,
                rutaImage: `${process.env.APP_URL}/files/company/${primeraEmpresa.rutaImage}`
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

            const file = path.join(__dirname, '..', "path", "company");

            if (!isDirectory(file)) {
                mkdir(file);
                chmod(file);
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

            let rutaLogo = "";

            if (req.body.logo !== "") {
                if (empresa[0].rutaLogo) {
                    const remove = removeFile(path.join(file, empresa[0].rutaLogo));
                    if (remove) {
                        console.log("se quito la imagen " + empresa[0].rutaLogo)
                    }
                }

                let timestamp = Date.now();
                let uniqueId = Math.random().toString(36).substring(2, 9);
                let nameImage = `${timestamp}_${uniqueId}.${req.body.extlogo}`;

                writeFile(path.join(file, nameImage), req.body.logo);

                rutaLogo = nameImage;
            } else {
                rutaLogo = empresa[0].rutaLogo;
            }

            let rutaImage = "";

            if (req.body.image !== "") {
                if (empresa[0].rutaImage) {
                    removeFile(path.join(file, empresa[0].rutaImage));
                }

                let timestamp = Date.now();
                let uniqueId = Math.random().toString(36).substring(2, 9);
                let nameImage = `${timestamp}_${uniqueId}.${req.body.extlogo}`;
                
                writeFile(path.join(file, nameImage), req.body.image);

                rutaImage = nameImage;
            } else {
                rutaImage = empresa[0].rutaImage;
            }

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
            console.log(error)
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