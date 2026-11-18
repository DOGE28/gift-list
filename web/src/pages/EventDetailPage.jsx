import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';

function EventDetailPage() {
  const { eventId } = useParams();
  const { user, logout } = useAuth();
  const [event, setEvent] = useState(null);
  const [items, setItems] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [guestTokens, setGuestTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showGuestTokenModal, setShowGuestTokenModal] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', url: '', individual_id: '' });
  const [newParticipant, setNewParticipant] = useState({ individual_id: '' });
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newToken, setNewToken] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventData, itemsData, participantsData, tokensData, individualsData] = await Promise.all([
        api.getEvent(eventId),
        api.getItems(eventId),
        api.getEvent(eventId).then(() => api.getEvent(eventId)), // participants embedded
        api.getGuestTokens(eventId),
        api.getIndividuals(),
      ]);
      setEvent(eventData.event);
      setItems(itemsData.items || []);
      setParticipants(eventData.participants || []);
      setGuestTokens(tokensData.tokens || []);
      setIndividuals(individualsData.individuals || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateItem(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createItem(eventId, newItem);
      setNewItem({ title: '', url: '', individual_id: '' });
      setShowAddItem(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddParticipant(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.addParticipant(eventId, newParticipant);
      setNewParticipant({ individual_id: '' });
      setShowAddParticipant(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateToken(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.createGuestToken(eventId, { label: newTokenLabel });
      setNewToken(data.token);
      setNewTokenLabel('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeToken(tokenId) {
    try {
      await api.revokeGuestToken(eventId, tokenId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteItem(itemId) {
    try {
      await api.deleteItem(itemId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleTogglePurchased(item) {
    try {
      await api.updateItem(item.id, { purchased: !item.purchased });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  if (!event) {
    return <div className="container"><div className="alert alert-error">Event not found</div></div>;
  }

  return (
    <div>
      <div className="header">
        <h1>
          <Link to="/dashboard">←</Link> {event.title}
        </h1>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => setShowAddItem(true)}>
            + Item
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAddParticipant(true)}>
            + Participant
          </button>
          <button className="btn btn-secondary" onClick={() => setShowGuestTokenModal(true)}>
            Guest Tokens
          </button>
          <button className="btn btn-danger" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <h2>{event.title}</h2>
          {event.description && <p>{event.description}</p>}
          <div className="meta">
            {event.event_date || 'No date set'}
            {event.is_active ? ' · Active' : ' · Inactive'}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await api.updateEvent(eventId, { is_active: !event.is_active });
                  await load();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              {event.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (confirm('Delete this event?')) {
                  await api.deleteEvent(eventId);
                  window.location.href = '/dashboard';
                }
              }}
            >
              Delete Event
            </button>
          </div>
        </div>

        <h3>Participants</h3>
        <div className="grid">
          {participants.map((p) => (
            <div key={p.individual_id} className="card">
              <h3>{p.name}</h3>
              {p.notes && <p>{p.notes}</p>}
            </div>
          ))}
          {participants.length === 0 && (
            <div className="empty">No participants added yet.</div>
          )}
        </div>

        <h3>Gift Items</h3>
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="item-info">
                <div className="name">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                  {item.purchased && <span className="badge badge-purchased">Purchased</span>}
                  {item.added_by_guest_token && <span className="badge badge-guest">Guest</span>}
                </div>
                <div className="meta">
                  {item.price && ` · $${item.price}`}
                  {item.individual && ` · For ${item.individual.name}`}
                </div>
              </div>
              <div className="item-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTogglePurchased(item)}
                >
                  {item.purchased ? 'Unmark' : 'Mark Purchased'}
                </button>
                {item.added_by_user_id === user.id && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <div className="empty">No gift items yet.</div>
          )}
        </ul>

        {showAddItem && (
          <div className="card">
            <h3>Add Gift Item</h3>
            <form onSubmit={handleCreateItem}>
              <div>
                <label htmlFor="item-title">Title</label>
                <input
                  id="item-title"
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="item-url">Product URL (optional)</label>
                <input
                  id="item-url"
                  type="url"
                  value={newItem.url}
                  onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="item-individual">For</label>
                <select
                  id="item-individual"
                  value={newItem.individual_id}
                  onChange={(e) => setNewItem({ ...newItem, individual_id: e.target.value })}
                  required
                >
                  <option value="">Select participant…</option>
                  {participants.map((p) => (
                    <option key={p.individual_id} value={p.individual_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="item-price">Price (optional)</label>
                <input
                  id="item-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.price || ''}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Add Item
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddItem(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showAddParticipant && (
          <div className="card">
            <h3>Add Participant</h3>
            <form onSubmit={handleAddParticipant}>
              <div>
                <label htmlFor="part-individual">Individual</label>
                <select
                  id="part-individual"
                  value={newParticipant.individual_id}
                  onChange={(e) => setNewParticipant({ individual_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {individuals.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Add
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddParticipant(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showGuestTokenModal && (
          <div className="card">
            <h3>Guest Tokens</h3>
            {newToken && (
              <div className="alert alert-success">
                <strong>New token:</strong> {newToken}
                <br />
                Guest link: <code>{window.location.origin}/g/{newToken}</code>
              </div>
            )}
            <form onSubmit={handleCreateToken}>
              <div>
                <label htmlFor="token-label">Label (optional)</label>
                <input
                  id="token-label"
                  type="text"
                  value={newTokenLabel}
                  onChange={(e) => setNewTokenLabel(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                Generate Token
              </button>
            </form>
            <div style={{ marginTop: '1rem' }}>
              {guestTokens.map((t) => (
                <div key={t.id} className="item-list" style={{ marginBottom: '0.5rem' }}>
                  <div>
                    <strong>{t.label || 'Unnamed'}</strong>
                    <span className="meta"> — {t.created_at}</span>
                  </div>
                  <div className="item-actions">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRevokeToken(t.id)}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
              {guestTokens.length === 0 && <div className="empty">No guest tokens yet.</div>}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowGuestTokenModal(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventDetailPage;
