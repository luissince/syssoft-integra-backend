
const container = require("../../common/container");

const findAll = require("./usecases/find-all.usecase");
const create = require("./usecases/create.usecase");
const update = require("./usecases/update.usecase");
const deleteById = require("./usecases/delete-by-id.usecase");
const resetPassword = require("./usecases/reset-password.usecase");
const findById = require("./usecases/find-by-id.usecase");
const getSelectOptions = require("./usecases/get-select-options.usecase");
const authenticate = require("./usecases/authenticate.usecase");
const refreshToken = require("./usecases/refresh-token.usecase");

class UsuarioService {
    constructor(container) {
        this.findAll = findAll(container);
        this.create = create(container);
        this.update = update(container);
        this.deleteById = deleteById(container);
        this.resetPassword = resetPassword(container);
        this.findById = findById(container);
        this.getSelectOptions = getSelectOptions(container);
        this.authenticate = authenticate(container);
        this.refreshToken = refreshToken(container);
    }
}

module.exports = new UsuarioService(container);