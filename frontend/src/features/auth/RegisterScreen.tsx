import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';

export function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ email: '', username: '', password: '', timezone: 'Asia/Colombo' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.email, form.username, form.password, form.timezone);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        'Registration failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
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
            required
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
            required
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
            required
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
            required
          />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>
        )}

        <Button variant="accent" fullWidth type="submit" style={{ marginTop: 8 }} disabled={loading}>
          {loading ? 'Creating…' : 'Create Character'}
        </Button>
      </form>

      <div className="auth-divider">
        Already have an account?{' '}
        <Link to="/login" className="auth-link">Log In</Link>
      </div>
    </div>
  );
}
