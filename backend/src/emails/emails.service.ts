import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      priority?: string;
      search?: string;
      isRead?: boolean;
    } = {},
  ) {
    const { page = 1, limit = 20, category, priority, search, isRead } = options;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (isRead !== undefined) where.isRead = isRead;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { fromAddress: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      this.prisma.email.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          toAddress: true,
          bodyPreview: true,
          summary: true,
          category: true,
          priority: true,
          isRead: true,
          isStarred: true,
          labels: true,
          receivedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.email.count({ where }),
    ]);

    return {
      data: emails,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, emailId: string) {
    const email = await this.prisma.email.findFirst({
      where: { id: emailId, userId },
    });

    if (email && !email.isRead) {
      await this.prisma.email.update({
        where: { id: emailId },
        data: { isRead: true },
      });
    }

    return email;
  }

  async toggleStar(userId: string, emailId: string) {
    const email = await this.prisma.email.findFirst({
      where: { id: emailId, userId },
    });
    if (!email) return null;

    return this.prisma.email.update({
      where: { id: emailId },
      data: { isStarred: !email.isStarred },
    });
  }

  async markAsRead(userId: string, emailId: string, isRead: boolean) {
    return this.prisma.email.updateMany({
      where: { id: emailId, userId },
      data: { isRead },
    });
  }
}
