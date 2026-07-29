import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}

export interface PaginationParams {
  limit: number;
  skip: number;
}

export function toPaginationParams(pagination: PaginationDto): PaginationParams {
  return {
    limit: pagination.limit ?? 50,
    skip: pagination.skip ?? 0,
  };
}
