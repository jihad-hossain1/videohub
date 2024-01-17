// Promise handler
const asyncHandlerPromise = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((error) =>
      next(error)
    );
  };
};

// const asyncHandler = () => { }
// const asyncHandler = (func) => () => { }
// const asyncHandler = (func) => async()=>{}
// try catch handler
const asyncHandler = (func) => async (req, res, next) => {
  try {
    await func(req, res, next);
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

export { asyncHandler, asyncHandlerPromise };
