import { useEffect, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { RANK_ICONS } from '../../utils/xp-calculator';

export function LevelUpOverlay() {
  const { levelUpData, dismissLevelUp } = useUiStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!levelUpData) return;
    startConfetti();
    return () => stopConfetti();
  }, [levelUpData]);

  function startConfetti() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = ['#2563eb', '#7c3aed', '#d97706', '#16a34a', '#dc2626', '#f59e0b', '#ec4899'];
    const parts = Array.from({ length: 180 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 3,
      col: cols[i % cols.length],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 6,
      shape: i % 3,
    }));

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.col;
        if (p.shape === 0) {
          ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        } else if (p.shape === 1) {
          ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.6, p.r * 0.6);
          ctx.lineTo(-p.r * 0.6, p.r * 0.6); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        p.x += p.vx; p.y += p.vy; p.rot += p.rv;
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
      }
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
  }

  function stopConfetti() {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (!levelUpData) return null;

  const rankIcon = RANK_ICONS[levelUpData.newRank] ?? '🥉';

  return (
    <>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div className="lvl-overlay">
        <div className="lvlup-wrap">
          <div className="lvlup-title">LEVEL UP!</div>
          <div className="lvlup-num">{levelUpData.newLevel}</div>
          <div className="lvlup-rank">{rankIcon} {levelUpData.newRank} Rank</div>
          <div className="lvlup-boost">{levelUpData.statBoostMessage}</div>
          <button className="lvlup-btn" onClick={dismissLevelUp}>
            AWESOME! ⚔️
          </button>
        </div>
      </div>
    </>
  );
}
