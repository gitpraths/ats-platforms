export default {
  apps: [
    {
      name: "ats-backend",
      cwd: "./packages/backend",
      script: "src/server.js",
      watch: false,
      env: { NODE_ENV: "development" },
    },
    {
      name: "ats-frontend",
      cwd: "./packages/frontend",
      script: "npx",
      args: "vite",
      watch: false,
      env: { NODE_ENV: "development" },
    },
  ],
};
