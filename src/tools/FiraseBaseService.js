const admin = require('firebase-admin');
require('dotenv').config();

class FirebaseService {
    static instance;

    constructor() {
        if (FirebaseService.instance) {
            return FirebaseService.instance;
        }

        try {
            // Intentar cargar el archivo de configuración
            const serviceAccount = require(`../path/certificates/${process.env.FIREBASE_FILE_ACCOUNT_NAME}`);

            // Inicializar Firebase
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_BUCKET
            });

            this.bucket = admin.storage().bucket();
        } catch (error) {
            throw new Error('Firebase no está inicializado correctamente.');
        }

        FirebaseService.instance = this;
    }

    getBucket() {
        return this.bucket;
    }
}

module.exports = FirebaseService;