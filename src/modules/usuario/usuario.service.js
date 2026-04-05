
const container = require("../../common/container");

const findAll = require("./usecases/find-all");
const create = require("./usecases/create");
const update = require("./usecases/update");
const deleteById = require("./usecases/delete-by-id");
const resetPassword = require("./usecases/reset-password");
const findById = require("./usecases/find-by-id");
const getSelectOptions = require("./usecases/get-select-options");
const authenticate = require("./usecases/authenticate");
const refreshToken = require("./usecases/refresh-token");

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