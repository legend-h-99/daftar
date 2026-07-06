import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { RecipeItemDto } from './recipe-item.dto';

export class CalculateProductDto {
  @IsNumber()
  @Min(0)
  @Max(99.99)
  profitMargin!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overheadCost?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  recipeItems!: RecipeItemDto[];
}
