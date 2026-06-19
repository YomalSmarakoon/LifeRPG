import { ApiProperty } from '@nestjs/swagger';

export class XpEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() delta!: number;
  @ApiProperty() source!: string;
  @ApiProperty() contextType!: string;
  @ApiProperty() contextId!: string;
  @ApiProperty() balanceBefore!: number;
  @ApiProperty() balanceAfter!: number;
  @ApiProperty() timestamp!: string;
}
