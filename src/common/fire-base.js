// services/FirebaseService.js
const admin = require('firebase-admin');
const logger = require('../tools/Logger');

class FireBase {
    constructor() {
        this.bucket = null;
    }

    initializeFirebase() {
        try {
            // Carga el archivo de credenciales de firebase
            const serviceAccount = require(`../path/certificates/${process.env.FIREBASE_FILE_ACCOUNT_NAME}`);

            // Inicializa la app de firebase
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_BUCKET
            });

            // Obtiene el bucket de firebase
            this.bucket = admin.storage().bucket();
        } catch (error) {
            this.bucket = null;
            throw error;
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
        logger.error(
            'FirebaseService',
            error.stack || error.message || error
        );

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
}

// Exportar una única instancia
module.exports = new FireBase();
