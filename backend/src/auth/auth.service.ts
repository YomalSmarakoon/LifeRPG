import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { CharactersService } from '../characters/characters.service';
import { HabitsService } from '../habits/habits.service';
import { RefreshSession, RefreshSessionDocument } from './schemas/refresh-session.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './types/jwt-payload.type';
import type { RegisterResponseDto, LoginResponseDto } from './dto/auth-response.dto';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

// Valid IANA timezone strings (validated at runtime via Intl.DateTimeFormat)
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private charactersService: CharactersService,
    private habitsService: HabitsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectModel(RefreshSession.name)
    private sessionModel: Model<RefreshSessionDocument>,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    if (!isValidTimezone(dto.timezone)) {
      throw new BadRequestException('timezone must be a valid IANA timezone string');
    }

    const bcryptRounds = this.configService.get<number>('bcryptRounds') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      username: dto.username,
      timezone: dto.timezone,
    });

    const userId = (user._id as { toString(): string }).toString();

    // Phase 4: create character and seed habits after user creation.
    // These are best-effort — user already exists if they throw, but
    // TODO Phase 5: wrap in a MongoDB transaction once all collections are stable.
    try {
      await this.charactersService.createDefault(userId);
      await this.habitsService.seedDefaults(userId);
    } catch (err: unknown) {
      this.logger.error(
        `Post-registration setup failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Do not surface internal failure to client — user record was created successfully
    }

    return {
      userId,
      email: user.email,
      username: user.username,
    };
  }

  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponseDto> {
    const INVALID_MSG = 'Invalid email or password';

    const user = await this.usersService.findByEmailWithHash(dto.email);
    if (!user) throw new UnauthorizedException(INVALID_MSG);

    // Check lockout before attempting bcrypt
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      const userId = (user._id as { toString(): string }).toString();
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;

      if (newAttempts >= LOCKOUT_THRESHOLD) {
        await this.usersService.lockAccount(
          userId,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
      } else {
        await this.usersService.incrementFailedAttempts(userId);
      }

      throw new UnauthorizedException(INVALID_MSG);
    }

    const userId = (user._id as { toString(): string }).toString();
    await this.usersService.resetLoginAttempts(userId);

    const accessToken = this.signAccessToken(userId, user.email, user.username);

    await this.createRefreshSession(userId, req, res);

    return {
      accessToken,
      user: {
        userId,
        email: user.email,
        username: user.username,
        timezone: user.timezone,
        createdAt: (user as unknown as { createdAt: Date }).createdAt.toISOString(),
      },
    };
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const cookieName = this.getCookieName();
    const plainToken: string | undefined = (req.cookies as Record<string, string>)[cookieName];

    if (!plainToken) throw new UnauthorizedException('No refresh token');

    const tokenHash = this.hashToken(plainToken);
    const session = await this.sessionModel.findOne({ tokenHash }).exec();

    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');

    // Theft detection — revoked token was replayed
    if (session.revoked) {
      await this.sessionModel
        .updateMany({ familyId: session.familyId }, { revoked: true, revokedAt: new Date() })
        .exec();
      this.clearRefreshCookie(res);
      this.logger.warn(
        `Refresh token theft detected for familyId=${session.familyId}. All sessions revoked.`,
      );
      throw new UnauthorizedException('Session compromised. Please log in again.');
    }

    // Rotate — revoke old, create new with same familyId
    session.revoked = true;
    session.revokedAt = new Date();
    await session.save();

    const userId = session.userId.toString();
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    const accessToken = this.signAccessToken(userId, user.email, user.username);

    await this.createRefreshSession(userId, req, res, session.familyId);

    return { accessToken };
  }

  async logout(req: Request, res: Response): Promise<void> {
    const cookieName = this.getCookieName();
    const plainToken: string | undefined = (req.cookies as Record<string, string>)[cookieName];

    if (plainToken) {
      const tokenHash = this.hashToken(plainToken);
      await this.sessionModel
        .findOneAndUpdate({ tokenHash, revoked: false }, { revoked: true, revokedAt: new Date() })
        .exec();
    }

    this.clearRefreshCookie(res);
  }

  async logoutAll(
    userId: string,
    req: Request,
    res: Response,
  ): Promise<{ sessionsRevoked: number }> {
    const result = await this.sessionModel
      .updateMany(
        { userId: new Types.ObjectId(userId), revoked: false },
        { revoked: true, revokedAt: new Date() },
      )
      .exec();

    this.clearRefreshCookie(res);

    return { sessionsRevoked: result.modifiedCount };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private signAccessToken(userId: string, email: string, username: string): string {
    const payload: JwtPayload = { sub: userId, email, username };
    return this.jwtService.sign(payload);
  }

  private async createRefreshSession(
    userId: string,
    req: Request,
    res: Response,
    existingFamilyId?: string,
  ): Promise<void> {
    const plainToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    const familyId = existingFamilyId ?? uuidv4();
    const expiresDays = this.configService.get<number>('refresh.tokenExpiresDays') ?? 7;
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash,
      familyId,
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      expiresAt,
      revoked: false,
      revokedAt: null,
    });

    const isProd = this.configService.get<string>('nodeEnv') === 'production';
    const cookieName = this.getCookieName();
    const apiPrefix = this.configService.get<string>('apiPrefix') ?? 'api/v1';

    res.cookie(cookieName, plainToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: `/${apiPrefix}/auth/refresh`,
      maxAge: expiresDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const cookieName = this.getCookieName();
    const apiPrefix = this.configService.get<string>('apiPrefix') ?? 'api/v1';

    res.cookie(cookieName, '', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: `/${apiPrefix}/auth/refresh`,
      maxAge: 0,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getCookieName(): string {
    return this.configService.get<string>('refresh.cookieName') ?? 'rt';
  }
}
