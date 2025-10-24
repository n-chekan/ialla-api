export default (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Ialla API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
};
