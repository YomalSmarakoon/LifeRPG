import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshSession, RefreshSessionSchema } from './schemas/refresh-session.schema';
import { UsersModule } from '../users/users.module';
import { CharactersModule } from '../characters/characters.module';
import { HabitsModule } from '../habits/habits.module';

@Module({
  imports: [
    UsersModule,
    CharactersModule,
    HabitsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: (configService.get<string>('jwt.accessExpiresIn') ?? '15m') as `${number}${'s'|'m'|'h'|'d'}`,
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: RefreshSession.name, schema: RefreshSessionSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
