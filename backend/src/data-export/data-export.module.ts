import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';
import { Habit, HabitSchema } from '../habits/schemas/habit.schema';
import { HabitLog, HabitLogSchema } from '../habits/schemas/habit-log.schema';
import { XpEvent, XpEventSchema } from '../xp/schemas/xp-event.schema';
import { UserAchievement, UserAchievementSchema } from '../achievements/schemas/user-achievement.schema';
import { AchievementDefinition, AchievementDefinitionSchema } from '../achievements/schemas/achievement-definition.schema';
import { UsersModule } from '../users/users.module';
import { CharactersModule } from '../characters/characters.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Habit.name, schema: HabitSchema },
      { name: HabitLog.name, schema: HabitLogSchema },
      { name: XpEvent.name, schema: XpEventSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: AchievementDefinition.name, schema: AchievementDefinitionSchema },
    ]),
    UsersModule,
    CharactersModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService],
})
export class DataExportModule {}
