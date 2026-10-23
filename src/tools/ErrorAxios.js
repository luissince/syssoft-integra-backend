const { default: axios } = require("axios");

class ErrorResponse {
    message = "Se produjo un error de servidor, intente nuevamente.";
    body = null;
    status = 500;
    type = "Server";

    constructor(error) {
        if (!axios.isAxiosError(error)) {
            return;
        }

        if (error.response) {
            const data = error.response.data;

            this.status = error.response.status || 502;
            this.message =
                data?.message ||
                (typeof data === "string" ? data : null) ||
                "Error en el servicio externo.";

            this.body = data?.body ?? null;
            this.type = "External Service";
        } else if (error.request) {
            this.status = 502;
            this.message = "No se pudo obtener la respuesta del servidor externo.";
            this.type = "Connection";
        } else {
            this.message = error.message || this.message;
            this.type = "External Service";
        }

        if (
            error.code === "ECONNABORTED" ||
            error.code === "ETIMEDOUT"
        ) {
            this.status = 504;
            this.message = "El servicio externo tardó demasiado en responder.";
            this.type = "Timeout";
        }
    }

    getMessage() {
        return this.message;
    }

    getType() {
        return this.type;
    }

    getStatus() {
        return this.status;
    }

    getBody() {
        return this.body;
    }
}

module.exports = ErrorResponse;