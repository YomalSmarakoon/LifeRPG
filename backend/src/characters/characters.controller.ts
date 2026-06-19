import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CharactersService } from './characters.service';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CharacterResponseDto } from './dto/character-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('character')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('character')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user character' })
  @ApiOkResponse({ type: CharacterResponseDto })
  @ApiUnauthorizedResponse()
  async getCharacter(@CurrentUser() user: CurrentUserPayload): Promise<CharacterResponseDto> {
    const character = await this.charactersService.getCharacterForUser(user.userId);
    return this.charactersService.toResponse(character);
  }

  @Patch()
  @ApiOperation({ summary: 'Update avatarEmoji or className' })
  @ApiOkResponse({ type: CharacterResponseDto })
  @ApiUnauthorizedResponse()
  async updateCharacter(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCharacterDto,
  ): Promise<CharacterResponseDto> {
    const character = await this.charactersService.updateCharacter(user.userId, dto);
    return this.charactersService.toResponse(character);
  }
}
