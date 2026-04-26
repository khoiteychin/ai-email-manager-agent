import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        oauthAccounts: {
          select: {
            provider: true,
            scope: true,
            metadata: true,
            updatedAt: true,
          },
        },
      },
    });
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }

  async getStats(userId: string) {
    const [totalEmails, unreadCount, categoryBreakdown, recentActivity] = await Promise.all([
      this.prisma.email.count({ where: { userId } }),
      this.prisma.email.count({ where: { userId, isRead: false } }),
      this.prisma.email.groupBy({
        by: ['category'],
        where: { userId },
        _count: { category: true },
      }),
      this.prisma.email.findMany({
        where: { userId },
        orderBy: { receivedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          category: true,
          priority: true,
          isRead: true,
          receivedAt: true,
          summary: true,
        },
      }),
    ]);

    return {
      totalEmails,
      unreadCount,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category || 'Unknown',
        count: c._count.category,
      })),
      recentActivity,
    };
  }
}
