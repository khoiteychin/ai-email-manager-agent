import { IsString, IsOptional, MinLength, MaxLength, IsEmail } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class DraftDto {
  @IsString()
  @MinLength(1)
  instruction: string;

  @IsOptional()
  @IsString()
  emailId?: string;

  @IsOptional()
  @IsString()
  context?: string;
}

export class SendEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  emailId?: string;
}
