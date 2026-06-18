import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  MONGODB_URI: Joi.string().uri().required(),

  // CORS
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),

  // API
  API_PREFIX: Joi.string().default('api/v1'),
  SWAGGER_ENABLED: Joi.boolean().default(true),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),

  // Refresh token
  REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).default(7),
  REFRESH_COOKIE_NAME: Joi.string().default('rt'),

  // Bcrypt
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(14).default(12),
});
