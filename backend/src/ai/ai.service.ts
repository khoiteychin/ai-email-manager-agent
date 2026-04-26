import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, DraftDto, SendEmailDto } from './dto/ai.dto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private prisma: PrismaService) {}

  async chat(userId: string, dto: ChatDto) {
    const sessionId = dto.sessionId || uuidv4();
    const n8nUrl = process.env.N8N_WEBHOOK_CHAT || `${process.env.N8N_BASE_URL}/webhook/discord-agent`;

    // Save user message
    await this.prisma.chatHistory.create({
      data: { userId, sessionId, role: 'user', content: dto.message },
    });

    // Call n8n webhook
    let aiResponse: string;
    try {
      const response = await axios.post(
        n8nUrl,
        { userId, message: dto.message, session_id: sessionId },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } },
      );
      aiResponse = response.data?.output || response.data?.message || JSON.stringify(response.data);
    } catch (err) {
      this.logger.error('n8n webhook error:', err.message);
      throw new BadGatewayException('AI service is temporarily unavailable. Please try again.');
    }

    // Save assistant response
    await this.prisma.chatHistory.create({
      data: { userId, sessionId, role: 'assistant', content: aiResponse },
    });

    return { sessionId, message: aiResponse };
  }

  async generateDraft(userId: string, dto: DraftDto) {
    const n8nUrl = process.env.N8N_WEBHOOK_DRAFT || `${process.env.N8N_BASE_URL}/webhook/email-draft`;

    try {
      const response = await axios.post(
        n8nUrl,
        { userId, instruction: dto.instruction, emailId: dto.emailId, context: dto.context },
        { timeout: 30000 },
      );
      return {
        draft: response.data?.draft || response.data,
        subject: response.data?.subject,
        body: response.data?.body,
      };
    } catch (err) {
      this.logger.error('n8n draft webhook error:', err.message);
      throw new BadGatewayException('Draft generation service unavailable.');
    }
  }

  async sendEmail(userId: string, dto: SendEmailDto) {
    const n8nUrl = process.env.N8N_WEBHOOK_SEND || `${process.env.N8N_BASE_URL}/webhook/email-send`;

    try {
      const response = await axios.post(
        n8nUrl,
        { userId, to: dto.to, subject: dto.subject, body: dto.body, emailId: dto.emailId },
        { timeout: 30000 },
      );
      return { success: true, result: response.data };
    } catch (err) {
      this.logger.error('n8n send webhook error:', err.message);
      throw new BadGatewayException('Email send service unavailable.');
    }
  }

  async getChatHistory(userId: string, sessionId: string) {
    return this.prisma.chatHistory.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.chatHistory.findMany({
      where: { userId },
      distinct: ['sessionId'],
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { sessionId: true, createdAt: true, content: true },
    });
    return sessions;
  }
}
