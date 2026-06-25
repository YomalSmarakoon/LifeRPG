import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RegisterResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  LogoutAllResponseDto,
} from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email or username already taken' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  @ApiOperation({ summary: 'Login and receive access + refresh tokens' })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Sets HttpOnly refresh cookie' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, req, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900_000, limit: 20 } })
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  @ApiOkResponse({ type: RefreshResponseDto, description: 'Rotates HttpOnly refresh cookie' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    return this.authService.refresh(req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — revoke current refresh session' })
  @ApiOkResponse({ description: 'Session revoked, cookie cleared' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, never>> {
    await this.authService.logout(req, res);
    return {};
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout all sessions for current user' })
  @ApiOkResponse({ type: LogoutAllResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logoutAll(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutAllResponseDto> {
    return this.authService.logoutAll(user.userId, req, res);
  }
}
