import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/utils/encrypt';
import axios from 'axios';

@Injectable()
export class ConnectService {
  private readonly logger = new Logger(ConnectService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Gmail OAuth2 ────────────────────────────────────────────────────────────

  getGmailAuthUrl(userId: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: userId, // pass userId to identify on callback
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGmailCallback(code: string, userId: string) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    try {
      const { data } = await axios.post(tokenUrl, {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const { access_token, refresh_token, scope, expires_in } = data;

      // Get user email from Google
      const { data: googleUser } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      // Encrypt tokens before storing
      await this.prisma.oAuthAccount.upsert({
        where: { userId_provider: { userId, provider: 'gmail' } },
        update: {
          accessToken: encrypt(access_token),
          refreshToken: refresh_token ? encrypt(refresh_token) : undefined,
          scope,
          metadata: { email: googleUser.email, name: googleUser.name, picture: googleUser.picture },
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider: 'gmail',
          accessToken: encrypt(access_token),
          refreshToken: refresh_token ? encrypt(refresh_token) : null,
          scope,
          metadata: { email: googleUser.email, name: googleUser.name, picture: googleUser.picture },
        },
      });

      return { provider: 'gmail', email: googleUser.email, connected: true };
    } catch (err) {
      this.logger.error('Gmail OAuth callback error:', err.message);
      throw new BadRequestException('Failed to connect Gmail account');
    }
  }

  // ─── Discord OAuth2 ───────────────────────────────────────────────────────────

  getDiscordAuthUrl(userId: string): string {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const scopes = ['identify', 'guilds'].join('%20');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state: userId,
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async handleDiscordCallback(code: string, userId: string) {
    const tokenUrl = 'https://discord.com/api/oauth2/token';

    try {
      const tokenData = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      });

      const { data: tokenRes } = await axios.post(tokenUrl, tokenData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const { access_token, refresh_token, scope } = tokenRes;

      // Get Discord user info
      const { data: discordUser } = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      // Get guilds
      const { data: guilds } = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` },
      }).catch(() => ({ data: [] }));

      const metadata = {
        discordUserId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        guilds: guilds.slice(0, 10).map((g: any) => ({ id: g.id, name: g.name })),
      };

      await this.prisma.oAuthAccount.upsert({
        where: { userId_provider: { userId, provider: 'discord' } },
        update: {
          accessToken: encrypt(access_token),
          refreshToken: refresh_token ? encrypt(refresh_token) : undefined,
          scope,
          metadata,
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider: 'discord',
          accessToken: encrypt(access_token),
          refreshToken: refresh_token ? encrypt(refresh_token) : null,
          scope,
          metadata,
        },
      });

      return {
        provider: 'discord',
        username: `${discordUser.username}#${discordUser.discriminator}`,
        connected: true,
      };
    } catch (err) {
      this.logger.error('Discord OAuth callback error:', err.message);
      throw new BadRequestException('Failed to connect Discord account');
    }
  }

  async disconnect(userId: string, provider: string) {
    await this.prisma.oAuthAccount.deleteMany({
      where: { userId, provider },
    });
    return { provider, disconnected: true };
  }

  async getConnectedAccounts(userId: string) {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: {
        provider: true,
        scope: true,
        metadata: true,
        updatedAt: true,
      },
    });
    return accounts;
  }
}
