const { createClient } = require('redis');

class RedisService {

    constructor() {
        this.client = null;
    }

    async getClient() {

        try {

            if (this.client?.isOpen) {
                return this.client;
            }

            this.client = createClient({
                socket: {
                    host: process.env.REDIS_HOST || '127.0.0.1',
                    port: Number(process.env.REDIS_PORT || 6379)
                },
                password: process.env.REDIS_PASSWORD || undefined
            });

            this.client.on('error', error => {
                console.error('Redis Error:', error);
            });

            await this.client.connect();

            return this.client;

        } catch (error) {

            this.client = null;

            console.error(
                'Redis no disponible:',
                error.message
            );

            return null;
        }
    }

    async get(key) {

        const client = await this.getClient();

        if (!client) {
            return null;
        }

        try {

            return await client.get(key);

        } catch (error) {

            console.error(
                'Redis GET error:',
                error.message
            );

            return null;
        }
    }

    async set(key, value, expiration = 3600) {

        const client = await this.getClient();

        if (!client) {
            return false;
        }

        try {

            await client.set(
                key,
                value,
                {
                    EX: expiration
                }
            );

            return true;

        } catch (error) {

            console.error(
                'Redis SET error:',
                error.message
            );

            return false;
        }
    }

    async delete(key) {

        const client = await this.getClient();

        if (!client) {
            return false;
        }

        try {

            await client.del(key);

            return true;

        } catch (error) {

            console.error(
                'Redis DELETE error:',
                error.message
            );

            return false;
        }
    }
}

module.exports = new RedisService();