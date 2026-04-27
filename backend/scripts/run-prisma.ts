import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Minimal .env parser
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
}

async function main() {
  loadEnv();

  let dbUrl = process.env.DATABASE_URL;

  // If AWS Secrets Manager is configured, fetch secrets
  if (process.env.AWS_APP_SECRET_NAME) {
    try {
      console.log(`⏳ Fetching secrets from AWS Secrets Manager: ${process.env.AWS_APP_SECRET_NAME}...`);
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
      const response = await client.send(
        new GetSecretValueCommand({ SecretId: process.env.AWS_APP_SECRET_NAME })
      );
      
      if (response.SecretString) {
        const secret = JSON.parse(response.SecretString);
        
        // 1. If it's the standard DB_HOST format
        if (secret.DB_HOST && secret.DB_USERNAME && secret.DB_PASSWORD && secret.DB_NAME) {
          const port = secret.DB_PORT || '5432';
          dbUrl = `postgresql://${secret.DB_USERNAME}:${secret.DB_PASSWORD}@${secret.DB_HOST}:${port}/${secret.DB_NAME}?schema=public`;
        } 
        // 2. If it's AWS RDS auto-generated format
        else if (secret.username && secret.host) {
          dbUrl = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port || 5432}/${secret.dbname || 'postgres'}?schema=public`;
        }
        // 3. Direct DATABASE_URL
        else if (secret.DATABASE_URL) {
          dbUrl = secret.DATABASE_URL;
        }
      }
    } catch (e: any) {
      console.error('❌ Failed to fetch from AWS Secrets Manager:', e.message);
    }
  } else {
    // Fallback to local .env host/username/password if AWS is not used
    if (!dbUrl && process.env.DB_HOST && process.env.DB_USERNAME && process.env.DB_PASSWORD) {
      const port = process.env.DB_PORT || '5432';
      const dbName = process.env.DB_NAME || 'postgres';
      dbUrl = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${port}/${dbName}?schema=public`;
    }
  }

  if (!dbUrl) {
    console.error('❌ Could not determine DATABASE_URL from environment or AWS Secrets Manager.');
    process.exit(1);
  }

  // Set the DATABASE_URL environment variable for Prisma
  process.env.DATABASE_URL = dbUrl;

  // Get the prisma command arguments passed to this script
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('✅ DATABASE_URL resolved successfully.');
    console.log('URL:', dbUrl.replace(/:[^:@]+@/, ':***@')); // Hide password
    process.exit(0);
  }

  console.log(`🚀 Running: npx prisma ${args.join(' ')}`);
  
  // Run the prisma command
  const child = spawn('npx', ['prisma', ...args], {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
