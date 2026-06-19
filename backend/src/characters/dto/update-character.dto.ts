import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateCharacterDto {
  @ApiPropertyOptional({ example: '🧙', maxLength: 4 })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  avatarEmoji?: string;

  @ApiPropertyOptional({ example: 'Full Stack Developer', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  className?: string;
}
