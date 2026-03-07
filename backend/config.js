require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_NAME: 'tasktime_token',
  COOKIE_OPTS: {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  },
  PIXEL_OFFICE_WEBHOOK_URL: process.env.PIXEL_OFFICE_WEBHOOK_URL || '',
  DEPLOY_LOG_PATH: process.env.DEPLOY_LOG_PATH || '/var/log/tasktime-deploy.log',
};
