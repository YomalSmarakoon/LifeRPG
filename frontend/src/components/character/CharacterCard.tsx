import type { Character } from '../../types';
import { RankBadge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { xpProgressPercent } from '../../utils/xp-calculator';

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const xpPct = xpProgressPercent(character.currentLevelXp, character.xpToNextLevel);

  return (
    <div className="card">
      <div className="char-avatar">{character.avatarEmoji}</div>
      <div className="char-name">{character.className}</div>
      <div className="char-class">Software Engineer — Full-Stack</div>
      <div className="inline-center" style={{ margin: '6px 0' }}>
        <RankBadge rank={character.rank} />
      </div>
      <div className="level-num">Level {character.level}</div>
      <div className="xp-info">
        {character.currentLevelXp.toLocaleString()} / {character.xpToNextLevel.toLocaleString()} XP to next level
      </div>
      <ProgressBar value={xpPct} />
    </div>
  );
}
