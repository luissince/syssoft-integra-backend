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
            if (process.env.ENVIRONMENT === 'development') {
                console.error('Firebase no se inicializó correctamente.');
            }

            logger.error('FirebaseService', 'Firebase no se inicializó correctamente.');
            this.bucket = null;
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
}

// Exportar una única instancia
module.exports = new FireBase();
