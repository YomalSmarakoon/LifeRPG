import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export function RegisterScreen() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '', timezone: 'Asia/Colombo' });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Phase 3 will wire this to POST /auth/register
    navigate('/');
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">⚔️</div>
      <div className="auth-title">Create Character</div>
      <div className="auth-sub">Begin your journey. Your legend starts now.</div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            name="email"
            className="form-input"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            name="username"
            className="form-input"
            placeholder="TheArchitect"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            name="password"
            className="form-input"
            placeholder="Min. 8 chars, one number"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Timezone</label>
          <input
            type="text"
            name="timezone"
            className="form-input"
            placeholder="Asia/Colombo"
            value={form.timezone}
            onChange={handleChange}
          />
        </div>

        <Button variant="accent" fullWidth type="submit" style={{ marginTop: 8 }}>
          Create Character
        </Button>
      </form>

      <div className="auth-divider">
        Already have an account?{' '}
        <Link to="/login" className="auth-link">Log In</Link>
      </div>
    </div>
  );
}
