const { ClientError } = require("../tools/Error");
const logger = require("../tools/Logger");
const { sendClient, sendError } = require("../tools/Message");

module.exports = function startHttpServer(app) {
    // middleware 404
    app.use((req, res) => {
        res.status(404).json({ message: "Route not found" });
    });

    // middleware global de errores (SIEMPRE al final)
    app.use((err, req, res, next) => {
        if (err instanceof ClientError) {
            return sendClient(res, {
                message: err.message || "Error de cliente",
                body: err.body ?? null
            }, "Client Error", err);
        }

        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Server", err);
    });

    app.listen(
        app.get("port"),
        '0.0.0.0',
        () => {
            logger.info(
                `🚀 HTTP iniciado en puerto ${app.get("port")}`
            );
        }
    );
};