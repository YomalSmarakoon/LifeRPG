import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Habit, HabitSchema } from './schemas/habit.schema';
import { HabitsService } from './habits.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Habit.name, schema: HabitSchema }])],
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
