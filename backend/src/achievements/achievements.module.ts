import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementDefinition, AchievementDefinitionSchema } from './schemas/achievement-definition.schema';
import { UserAchievement, UserAchievementSchema } from './schemas/user-achievement.schema';
import { Character, CharacterSchema } from '../characters/schemas/character.schema';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AchievementDefinition.name, schema: AchievementDefinitionSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: Character.name, schema: CharacterSchema },
    ]),
    XpModule,
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
