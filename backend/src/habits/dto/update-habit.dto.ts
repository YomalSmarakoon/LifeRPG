import { IsString, IsEnum, IsInt, IsOptional, IsBoolean, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateHabitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8) icon?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional() @IsInt() @Min(1) @Max(1000) @Type(() => Number) xpReward?: number;
  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard', 'legendary'] })
  @IsOptional() @IsEnum(['easy', 'medium', 'hard', 'legendary']) difficulty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() streakKey?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) sortOrder?: number;
}
