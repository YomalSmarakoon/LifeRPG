export default () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  mongodbUri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/liferpg',
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  apiPrefix: process.env['API_PREFIX'] ?? 'api/v1',
  swaggerEnabled: process.env['SWAGGER_ENABLED'] === 'true',
});
