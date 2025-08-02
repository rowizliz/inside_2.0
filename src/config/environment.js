// Environment configuration for different deployment stages

const config = {
  development: {
    socketUrl: process.env.REACT_APP_SOCKET_URL_DEV || 'http://localhost:3001',
    apiUrl: 'http://localhost:3000',
    environment: 'development'
  },
  production: {
    socketUrl: process.env.REACT_APP_SOCKET_URL_PROD || 'https://inside-backend.up.railway.app',
    apiUrl: process.env.REACT_APP_SOCKET_URL_PROD || 'https://inside-backend.up.railway.app',
    environment: 'production'
  }
};

// Determine current environment
const getCurrentEnvironment = () => {
  // Check if running on Vercel (production)
  if (window.location.hostname.includes('vercel.app') || 
      window.location.hostname.includes('inside-video-call')) {
    return 'production';
  }
  
  // Check environment variable
  if (process.env.REACT_APP_ENV === 'production') {
    return 'production';
  }
  
  // Default to development for localhost
  return 'development';
};

const currentEnv = getCurrentEnvironment();
const currentConfig = config[currentEnv];

// Export configuration
export const SOCKET_URL = currentConfig.socketUrl;
export const API_URL = currentConfig.apiUrl;
export const ENVIRONMENT = currentConfig.environment;

// Debug logging
console.log('🔧 Environment Config:', {
  environment: ENVIRONMENT,
  socketUrl: SOCKET_URL,
  hostname: window.location.hostname,
  isDev: ENVIRONMENT === 'development',
  isProd: ENVIRONMENT === 'production'
});

export default currentConfig;
