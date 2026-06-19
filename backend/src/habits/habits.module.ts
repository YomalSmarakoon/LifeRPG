import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Habit, HabitSchema } from './schemas/habit.schema';
import { HabitLog, HabitLogSchema } from './schemas/habit-log.schema';
import { Character, CharacterSchema } from '../characters/schemas/character.schema';
import { HabitsService } from './habits.service';
import { HabitsController } from './habits.controller';
import { XpModule } from '../xp/xp.module';
import { CharactersModule } from '../characters/characters.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Habit.name, schema: HabitSchema },
      { name: HabitLog.name, schema: HabitLogSchema },
      { name: Character.name, schema: CharacterSchema },
    ]),
    XpModule,
    CharactersModule,
    UsersModule,
  ],
  controllers: [HabitsController],
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
