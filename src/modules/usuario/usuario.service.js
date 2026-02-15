
const container = require("../../common/container");
const buildUsecases = require("../../common/build-usecases");

module.exports = buildUsecases(container, {
    findAll: require("./usecases/find-all.usecase"),
    create: require("./usecases/create.usecase"),
    update: require("./usecases/update.usecase"),
    deleteById: require("./usecases/delete-by-id.usecase"),
    resetPassword: require("./usecases/reset-password.usecase"),
    findById: require("./usecases/find-by-id.usecase"),
    getSelectOptions: require("./usecases/get-select-options.usecase"),
    authenticate: require("./usecases/authenticate.usecase"),
    refreshToken: require("./usecases/refresh-token.usecase"),
});
