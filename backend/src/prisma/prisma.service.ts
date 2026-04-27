import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Dynamically build DATABASE_URL from separate environment variables if it's not already set
    let dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl && process.env.DB_HOST && process.env.DB_USERNAME && process.env.DB_PASSWORD) {
      const port = process.env.DB_PORT || '5432';
      const dbName = process.env.DB_NAME || 'postgres';
      dbUrl = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${port}/${dbName}?schema=public`;
    }

    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
