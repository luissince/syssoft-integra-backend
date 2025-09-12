// cammon/rabbitmq.js
 const amqp = require("amqplib");
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
    console.log("📡 Conectando a RabbitMQ...");
    if (!this.connection) {
      this.connection = await amqp.connect({
        protocol: process.env.AMQP_PROTOCOL,
        hostname: process.env.AMQP_HOSTNAME,
        port: Number(process.env.AMQP_PORT),
        username: process.env.AMQP_USERNAME,
        password: process.env.AMQP_PASSWORD,
        vhost: process.env.AMQP_VHOST,
      });
      this.channel = await this.connection.createChannel();
      console.log("✅ Conectado a RabbitMQ");
    }
    return this.connection;
  }

  /**
   * Obtiene un canal de RabbitMQ.
   * @async
   * @returns {Promise<amqp.Channel>}
   */
  async getChannel() {
    if (!this.channel) {
      if (!this.connection) {
        await this.connect();
      }
      this.channel = await this.connection.createChannel();
    }
    return this.channel;
  }

  /**
   * Publica un mensaje en una cola de RabbitMQ.
   * @async
   * @param {string} queue - Nombre de la cola
   * @param {object} message - Mensaje en formato JSON
   * @param {boolean} [persistent=true] - Si el mensaje debe ser persistente
   * @returns {Promise<void>}
   */
  async publish(queue, message, persistent = true) {
    const channel = await this.getChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: persistent });
    console.log(`📤 Mensaje enviado a [${queue}]:`, message);
  }

  /**
   * Consume mensajes de una cola de RabbitMQ.
   * @async
   * @param {string} queue - Nombre de la cola
   * @param {(msg: amqp.ConsumeMessage | null) => void} callback - Función que procesa el mensaje
   * @returns {Promise<void>}
   */
  async consume(queue, callback) {
    const channel = await this.getChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.consume(queue, (msg) => {
      if (msg) {
        callback(msg);
        channel.ack(msg);
      }
    });
    console.log(`📥 Escuchando cola [${queue}]...`);
  }
}

module.exports = RabbitMQ;
