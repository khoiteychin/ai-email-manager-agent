import { Controller, Get, Query, Delete, Param, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConnectService } from './connect.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('connect')
export class ConnectController {
  constructor(private connectService: ConnectService) {}

  // ─── Gmail ──────────────────────────────────────────────────────────────────

  @Get('gmail')
  @UseGuards(JwtAuthGuard)
  async initiateGmail(@CurrentUser('id') userId: string, @Res() res: Response) {
    const url = this.connectService.getGmailAuthUrl(userId);
    return res.redirect(url);
  }

  @Get('gmail/callback')
  async gmailCallback(@Query('code') code: string, @Query('state') userId: string, @Res() res: Response) {
    try {
      await this.connectService.handleGmailCallback(code, userId);
      return res.redirect(`${process.env.FRONTEND_URL}/settings?connected=gmail`);
    } catch {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?error=gmail`);
    }
  }

  // ─── Discord ─────────────────────────────────────────────────────────────────

  @Get('discord')
  @UseGuards(JwtAuthGuard)
  async initiateDiscord(@CurrentUser('id') userId: string, @Res() res: Response) {
    const url = this.connectService.getDiscordAuthUrl(userId);
    return res.redirect(url);
  }

  @Get('discord/callback')
  async discordCallback(@Query('code') code: string, @Query('state') userId: string, @Res() res: Response) {
    try {
      await this.connectService.handleDiscordCallback(code, userId);
      return res.redirect(`${process.env.FRONTEND_URL}/settings?connected=discord`);
    } catch {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?error=discord`);
    }
  }

  // ─── Common ──────────────────────────────────────────────────────────────────

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  async getAccounts(@CurrentUser('id') userId: string) {
    return this.connectService.getConnectedAccounts(userId);
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser('id') userId: string, @Param('provider') provider: string) {
    return this.connectService.disconnect(userId, provider);
  }
}
