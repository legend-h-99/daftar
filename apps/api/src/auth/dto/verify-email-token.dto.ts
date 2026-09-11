import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class VerifyEmailTokenDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  code?: string;
}
