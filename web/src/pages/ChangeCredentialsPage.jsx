import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one capital letter.';
  if (!/[^a-zA-Z0-9 ]/.test(password)) return 'Password must include at least one special character.';
  return null;
}

function ChangeCredentialsPage() {
  const { changeCredentials, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (email.length < 3 || email.length > 254) {
      setError('Email must be between 3 and 254 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setSubmitting(true);
    try {
      await changeCredentials(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="card auth-card">
        <h2>Change Credentials</h2>
        <p style={{ marginBottom: '1rem', color: 'var(--text-muted, #888)' }}>
          You are using the default admin account. Please set a new email and a strong password
          before continuing.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="newEmail">New Email</label>
            <input
              id="newEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              minLength={3}
              maxLength={254}
            />
          </div>
          <div>
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-muted, #888)' }}>
              At least 8 characters, with a number, a capital letter, and a special character.
            </small>
          </div>
          <div>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Please wait…' : 'Update Credentials'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangeCredentialsPage;
