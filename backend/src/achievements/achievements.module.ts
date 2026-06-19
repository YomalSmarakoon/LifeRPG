import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementDefinition, AchievementDefinitionSchema } from './schemas/achievement-definition.schema';
import { AchievementsService } from './achievements.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AchievementDefinition.name, schema: AchievementDefinitionSchema },
    ]),
  ],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
