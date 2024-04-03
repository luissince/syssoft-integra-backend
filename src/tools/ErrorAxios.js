
class ErrorResponse {
    message = '';
    body = '';
    status = 400;

    constructor(error) {
        if (error.response) {
            this.status = error.response.status;
            this.message = error.response.data.message || error.response.data;
            this.body = error.response.data.body || '';
        } else if (error.request) {
            this.message = 'No se pudo obtener la respuesta del servidor.';
        } else {
            if (error.message === 'canceled') {
                this.message = 'Se canceló la solicitud la servidor';
            } else {
                this.message = error.message
                    ? error.message
                    : 'Algo salió mal, intente en un par de minutos.';
            }
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
