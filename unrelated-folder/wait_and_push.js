const { execSync } = require('child_process');
try {
  execSync('npm run db:push', { input: 'y\n', stdio: 'inherit' });
} catch (e) {
  console.log('Error pushing db');
}
