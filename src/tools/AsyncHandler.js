const { sendSuccess } = require("./Message");

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const makeController = (fn, getData) =>
  asyncHandler(async (req, res) => {
    const data = await fn(getData(req));
    return sendSuccess(res, data);
  });

module.exports = {
    asyncHandler,
    makeController,
};
