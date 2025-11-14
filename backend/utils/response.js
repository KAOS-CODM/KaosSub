const successResponse = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message: message
  };
  
  if (data) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

const errorResponse = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    error: message
  });
};

module.exports = {
  successResponse,
  errorResponse
};
