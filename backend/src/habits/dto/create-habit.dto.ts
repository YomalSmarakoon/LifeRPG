import {
  IsString, IsEnum, IsInt, IsOptional, IsBoolean, IsArray,
  Min, Max, MaxLength, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateHabitDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;

  @ApiPropertyOptional({ default: '📋' })
  @IsOptional() @IsString() @MaxLength(8) icon?: string;

  @ApiProperty({ enum: ['fitness', 'coding', 'reading', 'career', 'wellness', 'custom'] })
  @IsEnum(['fitness', 'coding', 'reading', 'career', 'wellness', 'custom']) category!: string;

  @ApiProperty({ enum: ['daily', 'weekly'] })
  @IsEnum(['daily', 'weekly']) frequency!: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @IsInt() @Min(1) @Max(1000) @Type(() => Number) xpReward!: number;

  @ApiProperty({ enum: ['easy', 'medium', 'hard', 'legendary'] })
  @IsEnum(['easy', 'medium', 'hard', 'legendary']) difficulty!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @ValidateIf((o: CreateHabitDto) => o.frequency === 'daily')
  streakKey?: string | null;

  @ApiPropertyOptional({ enum: ['manual', 'category_count', 'habit_count'] })
  @IsOptional() @IsEnum(['manual', 'category_count', 'habit_count'])
  @ValidateIf((o: CreateHabitDto) => o.frequency === 'weekly')
  weeklyTrackingMode?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  weeklyTarget?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  weeklyCategory?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  weeklyHabitIds?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Type(() => Number) sortOrder?: number;
}
