// src/config/s3.js
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

/**
 * Singleton para S3Client de AWS y generación de URLs firmadas.
 */
class S3Singleton {
  /** @type {S3Client|null} */
  static instance = null;

  /**
   * Obtiene la instancia única de S3Client.
   * @returns {S3Client} Instancia de S3Client
   */
  static getInstance() {
    if (!S3Singleton.instance) {
      S3Singleton.instance = new S3Client({
        region: process.env.AWS_REGION_S3,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID_S3,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_S3,
        },
      });
    }
    return S3Singleton.instance;
  }

  /**
   * Genera un URL firmado para obtener un objeto desde S3.
   * @param {string} key - Nombre o key del objeto en el bucket.
   * @param {number} [expiresInSeconds=3600] - Tiempo de expiración en segundos.
   * @returns {Promise<string>} URL firmado que expira en `expiresInSeconds`.
   */
  static async getSignedUrlFromS3(key, expiresInSeconds = 3600) {
    const s3 = S3Singleton.getInstance();
    const bucket = process.env.PDF_BUCKET;
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  }
}

module.exports = S3Singleton;
