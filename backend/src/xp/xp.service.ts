import { Injectable, NotFoundException } from '@nestjs/common';
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
import { XpEventResponseDto } from './dto/xp-event-response.dto';
import { XpSummaryResponseDto } from './dto/xp-summary-response.dto';

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

  async listEvents(
    userId: string,
    limit = 50,
    before?: string,
    source?: string,
  ): Promise<{ events: XpEventResponseDto[]; nextCursor: string | null }> {
    const userObjId = new Types.ObjectId(userId);
    const query: Record<string, unknown> = { userId: userObjId };

    if (before) {
      query['_id'] = { $lt: new Types.ObjectId(before) };
    }
    if (source) {
      query['source'] = source;
    }

    const cap = Math.min(limit, 100);
    const events = await this.xpEventModel
      .find(query)
      .sort({ _id: -1 })
      .limit(cap + 1)
      .exec();

    const hasMore = events.length > cap;
    const page = hasMore ? events.slice(0, cap) : events;

    return {
      events: page.map(this.toEventDto),
      nextCursor: hasMore ? (page[page.length - 1]._id as Types.ObjectId).toString() : null,
    };
  }

  async getSummary(userId: string): Promise<XpSummaryResponseDto> {
    const userObjId = new Types.ObjectId(userId);

    const [character, recentEvents] = await Promise.all([
      this.characterModel.findOne({ userId: userObjId }).exec(),
      this.xpEventModel
        .find({ userId: userObjId })
        .sort({ _id: -1 })
        .limit(10)
        .exec(),
    ]);

    if (!character) throw new NotFoundException('Character not found');

    return {
      totalXp: character.totalXp,
      level: character.level,
      currentLevelXp: character.currentLevelXp,
      xpToNextLevel: character.xpToNextLevel,
      rank: character.rank,
      gold: character.gold,
      stats: {
        STR: character.stats.STR,
        INT: character.stats.INT,
        WIS: character.stats.WIS,
        DEX: character.stats.DEX,
        CHA: character.stats.CHA,
        END: character.stats.END,
      },
      recentEvents: recentEvents.map(this.toEventDto),
    };
  }

  private toEventDto(e: XpEventDocument): XpEventResponseDto {
    return {
      id: (e._id as Types.ObjectId).toString(),
      delta: e.delta,
      source: e.source,
      contextType: e.contextType,
      contextId: e.contextId.toString(),
      balanceBefore: e.balanceBefore,
      balanceAfter: e.balanceAfter,
      timestamp: e.timestamp.toISOString(),
    };
  }
}
