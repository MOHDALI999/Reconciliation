import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['server/server.cjs'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.API_PORT || '8787' } }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
