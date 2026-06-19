import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UsersModule } from '../users/users.module';
import { CharactersModule } from '../characters/characters.module';
import { HabitsModule } from '../habits/habits.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [UsersModule, CharactersModule, HabitsModule, AchievementsModule, XpModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
