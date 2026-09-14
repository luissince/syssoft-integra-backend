const redisService = require('../common/redis');
const firebaseService = require('../common/fire-base');

class FirebaseService {

    async files(req) {
        try {
            const {
                search = '',
                prefix = '',
                contentType = 'image'
            } = req.query;

            const cacheKey = `firebase:files:${prefix}:${contentType}`;

            // Buscar primero en Redis
            const cached = await redisService.get(cacheKey);

            let files;

            if (cached) {

                console.log('Redis HIT:', cacheKey);

                files = JSON.parse(cached);

            } else {

                console.log('Redis MISS:', cacheKey);

                // Obtener desde Firebase
                files = await firebaseService.listFiles({
                    prefix,
                    contentType
                });

                // Guardar la lista completa en Redis
                await redisService.set(
                    cacheKey,
                    JSON.stringify(files),
                    3600
                );
            }

            // Filtrar en memoria
            const term = search.toLowerCase();

            const filtered = files.filter(file =>
                !term ||
                file.name.toLowerCase().includes(term)
            );

            return {
                success: true,
                data: filtered,
                source: cached ? 'redis' : 'firebase'
            };

        } catch (error) {

            return {
                success: false,
                message: error.message
            };

        }
    }
}

module.exports = new FirebaseService();