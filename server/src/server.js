import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startActivationJob } from './jobs/activationJob.js';
import { User } from './models/User.js';

async function autoSeedIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0 || process.env.AUTO_SEED === 'true') {
      if (userCount === 0) {
        console.log('No users found in database. Initializing first-run seed data...');
        const { seedUsers } = await import('./seed/seedUsers.js');
        const { seedRuleConfigs } = await import('./seed/seedRuleConfigs.js');
        const { seedTestTypes } = await import('./seed/seedTestTypes.js');
        const { activateDevRules } = await import('./seed/activateRules.js');
        const { seedDemoData } = await import('./seed/seedDemoData.js');

        await seedUsers();
        await seedRuleConfigs();
        await seedTestTypes();
        await activateDevRules();
        await seedDemoData();
        console.log('First-run seed data inserted successfully!');
      } else {
        console.log('Database already populated. Skipping duplicate auto-seeding.');
      }
    }
  } catch (seedErr) {
    console.warn('Auto-seed check notice:', seedErr.message);
  }
}

async function startServer() {
  await connectDB();
  
  await autoSeedIfEmpty();

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
