// PM2 Configuration for Sai Songs
// Documentation: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'saisongs',
      script: './dist/server/index.js',
      cwd: '/var/www/saisongs',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3111,
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3111,
        TNS_ADMIN: '/var/www/saisongs/wallet',
        LD_LIBRARY_PATH: '/opt/oracle/instantclient_21_13:/usr/lib',
      },
      
      // Load environment variables from .env file
      env_file: '/var/www/saisongs/.env',
      
      // Logging
      error_file: '/var/www/saisongs/logs/error.log',
      out_file: '/var/www/saisongs/logs/out.log',
      log_file: '/var/www/saisongs/logs/combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Monitoring
      instance_var: 'INSTANCE_ID',
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:srse369/saisongs.git',
      path: '/var/www/saisongs',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && npm run build:server && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};

