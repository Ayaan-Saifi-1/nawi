import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startActivationJob } from './jobs/activationJob.js';

async function startServer() {
  await connectDB();
  
  startActivationJob();

  app.listen(env.PORT, () => {
    console.log(`==================================================`);
    console.log(`NAWI Digital Metrology System Backend`);
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`API Base URL: http://localhost:${env.PORT}/api`);
    console.log(`==================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
