import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'yomal@example.com' })
  @IsEmail({}, { message: 'must be a valid email' })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: 'MinEight1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
