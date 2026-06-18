import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Phase 3 will wire this to POST /auth/login
    navigate('/');
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">⚔️</div>
      <div className="auth-title">Life RPG</div>
      <div className="auth-sub">Gamify your daily grind. Level up your life.</div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <Button variant="accent" fullWidth type="submit" style={{ marginTop: 8 }}>
          Log In
        </Button>
      </form>

      <div className="auth-divider">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="auth-link">Register</Link>
      </div>
    </div>
  );
}
