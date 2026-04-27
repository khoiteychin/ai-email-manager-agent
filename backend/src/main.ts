import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function bootstrap() {
  // Load ALL App Secrets from AWS Secrets Manager if configured
  if (process.env.AWS_APP_SECRET_NAME) {
    try {
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
      const response = await client.send(
        new GetSecretValueCommand({ SecretId: process.env.AWS_APP_SECRET_NAME })
      );
      if (response.SecretString) {
        const secret = JSON.parse(response.SecretString);
        
        // Push all keys from AWS to process.env
        for (const key of Object.keys(secret)) {
          process.env[key] = secret[key];
        }

        // Handle AWS RDS auto-generated format if needed
        if (secret.username && secret.host && !secret.DATABASE_URL) {
          process.env.DATABASE_URL = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname || 'postgres'}?schema=public`;
        }

        console.log('✅ Loaded App Configuration from AWS Secrets Manager');
      }
    } catch (e) {
      console.error('❌ Failed to load AWS Secret:', e);
    }
  }

  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — only allow frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 AI Email Manager Backend running on http://localhost:${port}/api`);
}

bootstrap();
