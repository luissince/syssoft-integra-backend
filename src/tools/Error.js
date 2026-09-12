class ClientError extends Error {
    constructor(message, body) {
        super(message);
        this.name = this.constructor.name;
        this.body = body;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { ClientError };
