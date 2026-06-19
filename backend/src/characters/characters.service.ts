import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Character, CharacterDocument } from './schemas/character.schema';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CharacterResponseDto } from './dto/character-response.dto';
import { statsForLevel, rankFromLevel, xpForLevel } from './utils/xp-calculator';

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
