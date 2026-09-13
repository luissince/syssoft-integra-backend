// common/FirebaseService.js
const admin = require('firebase-admin');
const { registerLog } = require('../tools/Tools');

class FireBase {
    constructor() {
        this.bucket = null;
    }

    initializeFirebase() {
        try {
            const serviceAccount = JSON.parse(
                Buffer.from(
                    process.env.FIREBASE_SERVICE_ACCOUNT,
                    "base64"
                ).toString("utf8")
            );

            // Inicializa la app de firebase
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_BUCKET
            });

            // Obtiene el bucket de firebase
            this.bucket = admin.storage().bucket();
        } catch (error) {
            this.bucket = null;
            registerLog('FireBase/initializeFirebase', error);
        }
    }

    getBucket() {
        // Intentar inicializar de nuevo si no se ha hecho
        if (!this.bucket) {
            this.initializeFirebase();
        }
        // Devolver el bucket de firebase
        return this.bucket;
    }

    async deleteFile(filePath) {
        try {
            if (!filePath) {
                return false;
            }

            const bucket = this.getBucket();

            if (!bucket) {
                return false;
            }

            const file = bucket.file(filePath);

            const [exists] = await file.exists();

            if (!exists) {
                return false;
            }

            await file.delete();

            return true;

        } catch (error) {

            this.handleFirebaseError(
                error,
                'No se pudo eliminar el archivo.'
            );
        }
    }

    async fileExists(filePath) {
        try {
            if (!filePath) {
                return false;
            }

            const bucket = this.getBucket();

            if (!bucket) {
                return false;
            }

            const file = bucket.file(filePath);

            const [exists] = await file.exists();

            return exists;

        } catch (error) {

            this.handleFirebaseError(
                error,
                'No se pudo validar el archivo.'
            );
        }
    }

    async downloadFile(filePath) {
        try {
            const bucket = this.getBucket();

            if (!bucket) {
                return null;
            }

            const file = bucket.file(filePath);

            const [buffer] = await file.download();

            return buffer;

        } catch (error) {

            this.handleFirebaseError(
                error,
                'No se pudo descargar el archivo.'
            );
        }
    }

    async uploadFile(
        filePath,
        buffer,
        contentType
    ) {
        try {
            const bucket = this.getBucket();

            if (!bucket) {
                return false;
            }

            const file = bucket.file(filePath);

            await file.save(buffer, {
                metadata: {
                    contentType
                }
            });

            await file.makePublic();

            return filePath;

        } catch (error) {
            this.handleFirebaseError(
                error,
                'No se pudo subir el archivo.'
            );
        }
    }

    handleFirebaseError(
        error,
        defaultMessage
    ) {
        registerLog('FireBase/handleFirebaseError', error);

        let message = defaultMessage;

        try {

            const responseData =
                typeof error.response?.data === 'string'
                    ? JSON.parse(error.response.data)
                    : error.response?.data;

            message =
                responseData?.error?.message ||
                message;

        } catch (_) { }

        throw new Error(message);
    }

    getUrl(name) {
        if (!this.bucket) {
            return null;
        }

        return `${process.env.FIREBASE_URL_PUBLIC}${this.bucket.name}/${name}`;
    }

    async searchFiles({
        search = '',
        prefix = '',
        contentType = 'image'
    } = {}) {
        try {
            const files = await this.listFiles({
                prefix,
                contentType
            });

            const term = search.toLowerCase();

            return files.filter(file =>
                !term || file.name.toLowerCase().includes(term)
            );

        } catch (error) {
            this.handleFirebaseError(
                error,
                'No se pudieron buscar los archivos.'
            );
        }
    }

    async listFiles({
        prefix = '',
        contentType = 'image'
    } = {}) {
        try {
            const bucket = this.getBucket();

            if (!bucket) {
                return [];
            }

            const [files] = await bucket.getFiles({
                prefix
            });

            console.log("==============================");
            console.log("ingresando a filter");

            return files
                .filter(file => {
                    return (
                        !contentType ||
                        file.metadata.contentType?.startsWith(contentType)
                    );
                })
                .map(file => ({
                    name: file.name,
                    size: file.metadata.size,
                    contentType: file.metadata.contentType,
                    created: file.metadata.timeCreated,
                    updated: file.metadata.updated,
                    url: this.getUrl(file.name),
                    metadata: file.metadata
                }));

        } catch (error) {
            this.handleFirebaseError(
                error,
                'No se pudieron obtener los archivos.'
            );
        }
    }
}

// Exportar una única instancia
module.exports = new FireBase();
