import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get('stats')
  async getStats(@CurrentUser('id') userId: string) {
    return this.userService.getStats(userId);
  }
}
