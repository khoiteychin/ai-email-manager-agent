import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Get,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token || (req.body as any)?.refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }
    const result = await this.authService.refresh(refreshToken);
    res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    await this.authService.logout(userId, refreshToken);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return user;
  }
}
