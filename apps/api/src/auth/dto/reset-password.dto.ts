import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(64)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
