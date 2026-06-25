import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UndoHabitDto {
  @ApiProperty({ example: '2026-06-19', description: 'YYYY-MM-DD — must be today in user timezone' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateKey must be YYYY-MM-DD' })
  dateKey!: string;
}
