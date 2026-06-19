import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { XpEvent, XpEventDocument } from './schemas/xp-event.schema';
import { Character, CharacterDocument } from '../characters/schemas/character.schema';
import {
  levelFromTotalXp,
  currentLevelXpFromTotal,
  rankFromLevel,
  statsForLevel,
  goldGainedFromLevels,
} from '../characters/utils/xp-calculator';

export interface AddXpEventResult {
  newTotalXp: number;
  levelBefore: number;
  levelAfter: number;
  rankBefore: string;
  rankAfter: string;
  goldBefore: number;
  goldAfter: number;
  actualDelta: number;
}

@Injectable()
export class XpService {
  constructor(
    @InjectModel(XpEvent.name) private xpEventModel: Model<XpEventDocument>,
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
  ) {}

  async addXpEvent(
    userId: Types.ObjectId,
    delta: number,
    source: 'habit_complete' | 'habit_undo' | 'achievement_unlock',
    contextType: string,
    contextId: Types.ObjectId,
    session: ClientSession,
  ): Promise<AddXpEventResult> {
    const character = await this.characterModel
      .findOne({ userId })
      .session(session)
      .exec();

    if (!character) throw new Error(`Character not found for userId ${userId.toString()}`);

    const actualDelta = delta < 0 ? Math.max(delta, -character.totalXp) : delta;
    const balanceBefore = character.totalXp;
    const balanceAfter = balanceBefore + actualDelta;

    await this.xpEventModel.create(
      [
        {
          userId,
          delta: actualDelta,
          source,
          contextType,
          contextId,
          balanceBefore,
          balanceAfter,
          timestamp: new Date(),
        },
      ],
      { session },
    );

    const levelBefore = character.level;
    const rankBefore = character.rank;
    const goldBefore = character.gold;

    const newLevel = levelFromTotalXp(balanceAfter);
    const goldGained = goldGainedFromLevels(levelBefore, newLevel);
    const goldAfter = goldBefore + goldGained;

    await this.characterModel
      .findOneAndUpdate(
        { userId },
        {
          totalXp: balanceAfter,
          currentLevelXp: currentLevelXpFromTotal(balanceAfter),
          xpToNextLevel: newLevel * 500,
          level: newLevel,
          rank: rankFromLevel(newLevel),
          stats: statsForLevel(newLevel),
          gold: goldAfter,
        },
        { session },
      )
      .exec();

    return {
      newTotalXp: balanceAfter,
      levelBefore,
      levelAfter: newLevel,
      rankBefore,
      rankAfter: rankFromLevel(newLevel),
      goldBefore,
      goldAfter,
      actualDelta,
    };
  }
}
