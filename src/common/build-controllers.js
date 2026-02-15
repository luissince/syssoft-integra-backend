const { makeController } = require("../tools/AsyncHandler");

/**
 * Construye controllers automáticamente para un service
 *
 * @param {object} service - objeto con métodos (findAll, create, etc.)
 * @param {object} config - definición de controllers
 *
 * config = {
 *   query: ["findAll"],
 *   params: ["findById", "deleteById"],
 *   body: ["create"],
 *   custom: { pdf: fn }
 * }
 */
module.exports = function buildControllers(service, config = {}) {
    const controllers = {};

    // 📌 query controllers
    if (config.query) {
        config.query.forEach((name) => {
            controllers[name] = makeController(service[name], (req) => req.query);
        });
    }

    // 📌 params controllers
    if (config.params) {
        config.params.forEach((name) => {
            controllers[name] = makeController(service[name], (req) => req.params);
        });
    }

    // 📌 body controllers
    if (config.body) {
        config.body.forEach((name) => {
            controllers[name] = makeController(service[name], (req) => req.body);
        });
    }

    // 📌 custom controllers (manual override)
    if (config.custom) {
        Object.assign(controllers, config.custom);
    }

    return controllers;
};
