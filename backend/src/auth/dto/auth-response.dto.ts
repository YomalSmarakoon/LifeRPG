import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: '6671a2b3c4d5e6f7a8b9c0d1' })
  userId!: string;

  @ApiProperty({ example: 'yomal@example.com' })
  email!: string;

  @ApiProperty({ example: 'TheArchitect' })
  username!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: '15-minute JWT access token' })
  accessToken!: string;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'New 15-minute JWT access token' })
  accessToken!: string;
}

export class LogoutAllResponseDto {
  @ApiProperty({ example: 3 })
  sessionsRevoked!: number;
}
