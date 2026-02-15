const container = require("../../common/container");
const buildUsecases = require("../../common/build-usecases");

module.exports = buildUsecases(container, {
    init: require('./usecases/init.usecase'),
});