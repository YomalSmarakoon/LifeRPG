import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { XpEvent, XpEventSchema } from './schemas/xp-event.schema';
import { XpService } from './xp.service';
import { Character, CharacterSchema } from '../characters/schemas/character.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: XpEvent.name, schema: XpEventSchema },
      { name: Character.name, schema: CharacterSchema },
    ]),
  ],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
