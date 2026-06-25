import { ApiProperty } from '@nestjs/swagger';

export class FieldError {
  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'must be a valid email' })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: [FieldError], required: false })
  errors?: FieldError[];

  @ApiProperty({ example: '/api/v1/example' })
  path!: string;

  @ApiProperty({ example: '2026-06-17T06:00:00.000Z' })
  timestamp!: string;
}
