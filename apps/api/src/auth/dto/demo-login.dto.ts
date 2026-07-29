import { IsString } from 'class-validator';

export class DemoLoginDto {
  @IsString()
  phone!: string;
}
