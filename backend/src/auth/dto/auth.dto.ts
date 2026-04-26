import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password too long' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
