import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { EmailsService } from './emails.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

class EmailQueryDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  priority?: string;

  @IsOptional()
  search?: string;

  @IsOptional()
  isRead?: string;
}

@Controller('emails')
@UseGuards(JwtAuthGuard)
export class EmailsController {
  constructor(private emailsService: EmailsService) {}

  @Get()
  async findAll(@CurrentUser('id') userId: string, @Query() query: EmailQueryDto) {
    return this.emailsService.findAll(userId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      category: query.category,
      priority: query.priority,
      search: query.search,
      isRead: query.isRead !== undefined ? query.isRead === 'true' : undefined,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser('id') userId: string, @Param('id') emailId: string) {
    return this.emailsService.findOne(userId, emailId);
  }

  @Patch(':id/star')
  async toggleStar(@CurrentUser('id') userId: string, @Param('id') emailId: string) {
    return this.emailsService.toggleStar(userId, emailId);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') emailId: string,
    @Body('isRead') isRead: boolean,
  ) {
    return this.emailsService.markAsRead(userId, emailId, isRead);
  }
}
