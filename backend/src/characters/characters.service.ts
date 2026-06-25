import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Character, CharacterDocument } from './schemas/character.schema';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CharacterResponseDto } from './dto/character-response.dto';
import { statsForLevel, rankFromLevel, xpForLevel } from './utils/xp-calculator';
import { calendarDaysBetween, previousDayKey } from '../common/utils/date.utils';

@Injectable()
export class CharactersService {
  constructor(
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
  ) {}

  async createDefault(userId: string): Promise<CharacterDocument> {
    const initialStats = statsForLevel(1);
    return this.characterModel.create({
      userId: new Types.ObjectId(userId),
      totalXp: 0,
      level: 1,
      currentLevelXp: 0,
      xpToNextLevel: xpForLevel(1),
      rank: rankFromLevel(1),
      gold: 0,
      stats: initialStats,
      avatarEmoji: '⚔️',
      className: 'Software Engineer',
      streaks: {
        gym:       { current: 0, shields: 0, lastDateKey: null },
        code:      { current: 0, shields: 0, lastDateKey: null },
        reading:   { current: 0, shields: 0, lastDateKey: null },
        earlyRise: { current: 0, shields: 0, lastDateKey: null },
      },
      totalHabitsCompleted: 0,
      lastActiveDate: null,
    });
  }

  async findByUserId(userId: string): Promise<CharacterDocument | null> {
    return this.characterModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async getCharacterForUser(userId: string): Promise<CharacterDocument> {
    const character = await this.findByUserId(userId);
    if (!character) throw new NotFoundException('Character not found');
    return character;
  }

  async updateCharacter(userId: string, dto: UpdateCharacterDto): Promise<CharacterDocument> {
    const update: Partial<Character> = {};
    if (dto.avatarEmoji !== undefined) update.avatarEmoji = dto.avatarEmoji;
    if (dto.className !== undefined) update.className = dto.className;

    const updated = await this.characterModel
      .findOneAndUpdate({ userId: new Types.ObjectId(userId) }, update, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Character not found');
    return updated;
  }

  async updateStreakCache(
    userId: Types.ObjectId,
    streakKey: string,
    dateKey: string,
    _userTimezone: string,
    session: ClientSession,
  ): Promise<{ newCount: number; shieldEarned: boolean }> {
    const character = await this.characterModel
      .findOne({ userId })
      .session(session)
      .exec();
    if (!character) throw new NotFoundException('Character not found');

    const streaks = character.streaks as unknown as Record<
      string,
      { current: number; shields: number; lastDateKey: string | null }
    >;
    const sk = streaks[streakKey] ?? { current: 0, shields: 0, lastDateKey: null };

    // Guard: already updated today
    if (sk.lastDateKey === dateKey) {
      return { newCount: sk.current, shieldEarned: false };
    }

    const gap = calendarDaysBetween(sk.lastDateKey, dateKey);
    const yesterdayKey = previousDayKey(dateKey);

    if (sk.lastDateKey === null || gap === null || gap > 2) {
      sk.current = 1;
      sk.lastDateKey = dateKey;
    } else if (sk.lastDateKey === yesterdayKey) {
      sk.current++;
      sk.lastDateKey = dateKey;
    } else if (gap === 2 && sk.shields > 0) {
      sk.shields--;
      sk.current++;
      sk.lastDateKey = dateKey;
    } else {
      sk.current = 1;
      sk.lastDateKey = dateKey;
    }

    let shieldEarned = false;
    if (sk.current % 7 === 0) {
      sk.shields = Math.min(sk.shields + 1, 3);
      shieldEarned = true;
    }

    await this.characterModel
      .findOneAndUpdate(
        { userId },
        { [`streaks.${streakKey}`]: sk },
        { session },
      )
      .exec();

    return { newCount: sk.current, shieldEarned };
  }

  async recomputeStreakFromLogs(
    userId: Types.ObjectId,
    streakKey: string,
    userTimezone: string,
    session: ClientSession,
    habitLogModel: Model<unknown>,
    habitModel: Model<unknown>,
  ): Promise<void> {
    // Find all habits for this user with this streakKey
    const streakHabits = await (habitModel as Model<{ _id: Types.ObjectId; streakKey: string }>)
      .find({ userId, streakKey, isActive: true })
      .session(session)
      .select('_id')
      .exec();
    const habitIds = streakHabits.map((h) => h._id);

    // Load last 90 days of active daily logs for these habits
    const logs = await (
      habitLogModel as Model<{ habitId: Types.ObjectId; dateKey: string }>
    )
      .find({
        userId,
        habitId: { $in: habitIds },
        logType: 'daily',
        undone: false,
      })
      .session(session)
      .select('dateKey')
      .sort({ dateKey: -1 })
      .limit(90)
      .exec();

    const dateSet = new Set(logs.map((l) => l.dateKey));

    // Walk backwards from today
    const { toDateKey } = await import('../common/utils/date.utils');
    const todayKey = toDateKey(new Date(), userTimezone);
    let current = 0;
    let d = todayKey;
    while (dateSet.has(d)) {
      current++;
      d = previousDayKey(d);
    }

    const mostRecent = logs.length > 0 ? logs[0].dateKey : null;

    const character = await this.characterModel
      .findOne({ userId })
      .session(session)
      .exec();
    if (!character) return;

    const streaks = character.streaks as unknown as Record<
      string,
      { current: number; shields: number; lastDateKey: string | null }
    >;
    const existingShields = streaks[streakKey]?.shields ?? 0;

    await this.characterModel
      .findOneAndUpdate(
        { userId },
        {
          [`streaks.${streakKey}`]: {
            current,
            shields: existingShields,
            lastDateKey: current > 0 ? mostRecent : null,
          },
        },
        { session },
      )
      .exec();
  }

  toResponse(character: CharacterDocument): CharacterResponseDto {
    return {
      level: character.level,
      totalXp: character.totalXp,
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
      avatarEmoji: character.avatarEmoji,
      className: character.className,
      streaks: {
        gym:       { current: character.streaks.gym.current, shields: character.streaks.gym.shields },
        code:      { current: character.streaks.code.current, shields: character.streaks.code.shields },
        reading:   { current: character.streaks.reading.current, shields: character.streaks.reading.shields },
        earlyRise: { current: character.streaks.earlyRise.current, shields: character.streaks.earlyRise.shields },
      },
    };
  }
}
