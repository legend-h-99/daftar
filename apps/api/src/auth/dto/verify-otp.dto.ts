import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must be a valid phone number (digits only, optional leading +)',
  })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'code must be a 6-digit numeric code' })
  code!: string;
}
