import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatDto, DraftDto, SendEmailDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  async chat(@CurrentUser('id') userId: string, @Body() dto: ChatDto) {
    return this.aiService.chat(userId, dto);
  }

  @Post('draft')
  async generateDraft(@CurrentUser('id') userId: string, @Body() dto: DraftDto) {
    return this.aiService.generateDraft(userId, dto);
  }

  @Post('send')
  async sendEmail(@CurrentUser('id') userId: string, @Body() dto: SendEmailDto) {
    return this.aiService.sendEmail(userId, dto);
  }

  @Get('sessions')
  async getSessions(@CurrentUser('id') userId: string) {
    return this.aiService.getSessions(userId);
  }

  @Get('sessions/:sessionId')
  async getChatHistory(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.aiService.getChatHistory(userId, sessionId);
  }
}
