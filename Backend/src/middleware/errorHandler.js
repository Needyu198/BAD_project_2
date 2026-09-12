export function notFoundHandler(req, res) {
  return res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  console.error(error)

  const statusCode = Number(error?.statusCode) || Number(error?.status) || 500
  return res.status(statusCode).json({
    message: error?.message || 'Internal server error',
  })
}
