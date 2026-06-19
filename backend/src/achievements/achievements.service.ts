import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AchievementDefinition, AchievementDefinitionDocument } from './schemas/achievement-definition.schema';
import { ACHIEVEMENT_DEFINITIONS } from './seeds/achievement-definitions.seed';

@Injectable()
export class AchievementsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @InjectModel(AchievementDefinition.name)
    private definitionModel: Model<AchievementDefinitionDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedIfEmpty();
  }

  async seedIfEmpty(): Promise<void> {
    const count = await this.definitionModel.countDocuments().exec();
    if (count >= ACHIEVEMENT_DEFINITIONS.length) {
      return;
    }

    // Upsert each definition by code — idempotent across restarts
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await this.definitionModel
        .findOneAndUpdate({ code: def.code }, def, { upsert: true, new: true })
        .exec();
    }

    this.logger.log(`Achievement definitions seeded (${ACHIEVEMENT_DEFINITIONS.length} total)`);
  }

  async findAll(): Promise<AchievementDefinitionDocument[]> {
    return this.definitionModel.find().exec();
  }
}
