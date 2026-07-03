// cammon/rabbitmq.js
const amqp = require("amqplib");
const logger = require("../tools/Logger");
/**
 * Clase Singleton para manejar la conexión a RabbitMQ.
 */
class RabbitMQ {
  /** @type {RabbitMQ | null} */
  static instance = null;

  /** @type {amqp.Connection | null} */
  connection = null;

  /** @type {amqp.Channel | null} */
  channel = null;

  /** @type {boolean} */
  reconnecting = false;

  constructor() {
    if (RabbitMQ.instance) {
      return RabbitMQ.instance;
    }
    RabbitMQ.instance = this;
  }

  /**
   * Obtiene la única instancia de la clase RabbitMQ.
   * @returns {RabbitMQ}
   */
  static getInstance() {
    if (!RabbitMQ.instance) {
      RabbitMQ.instance = new RabbitMQ();
    }
    return RabbitMQ.instance;
  }

  /**
   * Conecta al servidor RabbitMQ.
   * @async
   * @returns {Promise<amqp.Connection>}
   */
  async connect() {
    if (this.connection) return this.connection;

    try {
      logger.info("📡 Conectando a RabbitMQ...");
      this.connection = await amqp.connect({
        protocol: process.env.AMQP_PROTOCOL,
        hostname: process.env.AMQP_HOSTNAME,
        port: Number(process.env.AMQP_PORT),
        username: process.env.AMQP_USERNAME,
        password: process.env.AMQP_PASSWORD,
        vhost: process.env.AMQP_VHOST,
      });

      this.connection.on("error", (err) => {
        logger.error("❌ RabbitMQ error:", err.message);
      });

      this.connection.on("close", () => {
        logger.warn("⚠️ RabbitMQ connection closed");
        this.connection = null;
        this.channel = null;
        this.reconnect();
      });

      this.channel = await this.connection.createChannel();
    
      logger.info("✅ Conectado a RabbitMQ");
      return this.connection;

    } catch (err) {
      logger.warn("⚠️ Error conectando RabbitMQ:", err.message);
      this.connection = null;
      this.channel = null;
      this.reconnect();
    }
  }

  /**
   * Intenta reconectar a RabbitMQ.
   * @async
   * @returns {Promise<void>}
   */
  async reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;

    logger.info("🔁 Reintentando conexión a RabbitMQ en 5s...");

    setTimeout(async () => {
      this.reconnecting = false;
      await this.connect();
    }, 5000);
  }

  /**
   * Obtiene un canal de RabbitMQ.
   * @async
   * @returns {Promise<amqp.Channel>}
   */
  async getChannel() {
    if (!this.connection || !this.channel) {
      await this.connect();
    }
    return this.channel;
  }

  /**
   * Publica un mensaje en una cola de RabbitMQ.
   * @async
   * @param {string} queue - Nombre de la cola
   * @param {string} pattern - Patrón de la cola
   * @param {object} data - Mensaje en formato JSON
   * @param {boolean} [persistent=true] - Si el mensaje debe ser persistente
   * @returns {Promise<void>}
   */
  async publish(queue, pattern, data, persistent = true) {
    try {
      const channel = await this.getChannel();
      if (!channel) throw new Error("No channel available");

      await channel.assertQueue(queue, { durable: true });

      channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify({ pattern, data })),
        { persistent }
      );

    } catch (err) {
      logger.error("❌ Publish failed:", err.message);
    }
  }

  /**
   * Consume mensajes de una cola de RabbitMQ.
   * @async
   * @param {string} queue - Nombre de la cola
   * @param {(data: any) => void | Promise<void>} callback - Función que procesa el mensaje
   * @returns {Promise<void>}
   */
  async consume(queue, callback) {
    const channel = await this.getChannel();
    if (!channel) return;

    await channel.assertQueue(queue, { durable: true });

    channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());

        await callback(payload.pattern, payload.data);

        channel.ack(msg);
      } catch (err) {
        logger.error("❌ Consume error:", err.message);
        channel.nack(msg, false, true);
      }
    });
  }

}

module.exports = RabbitMQ.getInstance();
