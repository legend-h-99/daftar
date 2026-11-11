import { IsEmail, IsOptional, IsString } from 'class-validator';

// No password here: the mailbox owner chooses it when verifying the email.
export class RegisterEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}
