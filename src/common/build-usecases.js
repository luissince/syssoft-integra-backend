module.exports = function buildUsecases(container, usecases) {
    if (!container) throw new Error("Container is required");

    const result = {};

    for (const key in usecases) {
        if (typeof usecases[key] !== "function") {
            throw new Error(`Usecase "${key}" is not a function`);
        }

        result[key] = usecases[key](container);
    }

    return result;
};
