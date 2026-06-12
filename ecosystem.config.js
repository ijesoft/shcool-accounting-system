module.exports = {
  apps: [{
    name: "school-accounting",
    cwd: "/home/ubuntu/Github/shcool-accounting-system",
    script: "npm",
    args: "start -- --port 3002 --hostname 0.0.0.0",
    env: {
      NODE_ENV: "production",
    },
    max_restarts: 5,
    min_uptime: "10s",
  }],
};
