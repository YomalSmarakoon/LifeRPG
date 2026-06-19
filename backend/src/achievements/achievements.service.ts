import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { AchievementDefinition, AchievementDefinitionDocument } from './schemas/achievement-definition.schema';
import { UserAchievement, UserAchievementDocument } from './schemas/user-achievement.schema';
import { ACHIEVEMENT_DEFINITIONS } from './seeds/achievement-definitions.seed';
import { AchievementResponseDto } from './dto/achievement-response.dto';
import { XpService } from '../xp/xp.service';
import { Character, CharacterDocument } from '../characters/schemas/character.schema';

export interface UnlockedAchievementResult {
  code: string;
  name: string;
  xpAwarded: number;
}

@Injectable()
export class AchievementsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @InjectModel(AchievementDefinition.name)
    private definitionModel: Model<AchievementDefinitionDocument>,
    @InjectModel(UserAchievement.name)
    private userAchievementModel: Model<UserAchievementDocument>,
    @InjectModel(Character.name)
    private characterModel: Model<CharacterDocument>,
    private xpService: XpService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedIfEmpty();
  }

  async seedIfEmpty(): Promise<void> {
    const count = await this.definitionModel.countDocuments().exec();
    if (count >= ACHIEVEMENT_DEFINITIONS.length) {
      return;
    }

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

  async findAllWithStatus(userId: string): Promise<AchievementResponseDto[]> {
    const userObjId = new Types.ObjectId(userId);
    const [definitions, userAchievements] = await Promise.all([
      this.definitionModel.find().exec(),
      this.userAchievementModel.find({ userId: userObjId }).exec(),
    ]);

    const unlockedMap = new Map<string, UserAchievementDocument>(
      userAchievements.map((ua) => [ua.achievementCode, ua]),
    );

    return definitions.map((def) => {
      const ua = unlockedMap.get(def.code);
      return {
        code: def.code,
        name: def.name,
        icon: def.icon,
        description: def.description,
        xpReward: def.xpReward,
        category: def.category,
        unlocked: !!ua,
        unlockedAt: ua ? ua.unlockedAt.toISOString() : null,
        xpAwarded: ua ? ua.xpAwarded : null,
      };
    });
  }

  // Called inside a MongoDB transaction after all habit/weekly XP events are complete.
  // Evaluates conditions against the in-session character state, grants XP per unlock,
  // and loops up to 3 passes to handle cascades (e.g. achievement XP → level up → new achievement).
  async evaluateAndUnlockAchievements(
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<UnlockedAchievementResult[]> {
    const allUnlocked: UnlockedAchievementResult[] = [];
    const definitions = await this.definitionModel.find().exec();

    for (let pass = 0; pass < 3; pass++) {
      const character = await this.characterModel
        .findOne({ userId })
        .session(session)
        .exec();
      if (!character) break;

      const existingUnlocked = await this.userAchievementModel
        .find({ userId }, { achievementCode: 1 })
        .session(session)
        .exec();
      const unlockedCodes = new Set(existingUnlocked.map((u) => u.achievementCode));

      const newUnlocks = definitions.filter(
        (d) => !unlockedCodes.has(d.code) && this.conditionMet(d.condition, character),
      );

      if (newUnlocks.length === 0) break;

      for (const def of newUnlocks) {
        const [ua] = await this.userAchievementModel.create(
          [
            {
              userId,
              achievementDefinitionId: def._id as Types.ObjectId,
              achievementCode: def.code,
              unlockedAt: new Date(),
              xpAwarded: def.xpReward,
            },
          ],
          { session },
        );

        await this.xpService.addXpEvent(
          userId,
          def.xpReward,
          'achievement_unlock',
          'user_achievements',
          (ua._id as Types.ObjectId),
          session,
        );

        allUnlocked.push({ code: def.code, name: def.name, xpAwarded: def.xpReward });
        this.logger.log(`Achievement unlocked: ${def.code} for user ${userId.toString()}`);
      }
    }

    return allUnlocked;
  }

  private conditionMet(
    condition: { type: string; threshold: number },
    character: CharacterDocument,
  ): boolean {
    switch (condition.type) {
      case 'totalHabitsCompleted_gte':
        return character.totalHabitsCompleted >= condition.threshold;
      case 'level_gte':
        return character.level >= condition.threshold;
      case 'anyStreakCurrent_gte': {
        const streaks = character.streaks as unknown as Record<
          string,
          { current: number } | undefined
        >;
        return Object.values(streaks).some((s) => (s?.current ?? 0) >= condition.threshold);
      }
      default:
        return false;
    }
  }
}
