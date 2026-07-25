const path = require("node:path");

const projectRoot = __dirname;
const sharedOptions = {
  cwd: projectRoot,
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  watch: false,
  restart_delay: 3000,
  min_uptime: 10000,
  max_restarts: 10,
  kill_timeout: 10000,
  time: true,
  merge_logs: true,
  env: {
    NODE_ENV: "production",
    TZ: "Asia/Shanghai",
  },
  env_production: {
    NODE_ENV: "production",
    TZ: "Asia/Shanghai",
  },
};

module.exports = {
  apps: [
    {
      ...sharedOptions,
      name: "tech-bot-web",
      script: path.join(projectRoot, "server", "index.js"),
      max_memory_restart: "768M",
    },
    {
      ...sharedOptions,
      name: "tech-bot-feishu-ws",
      script: path.join(projectRoot, "server", "long-connection.js"),
      max_memory_restart: "512M",
    },
  ],
};
