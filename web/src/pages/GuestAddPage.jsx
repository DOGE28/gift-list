import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api.js';

function GuestAddPage() {
  const { token } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newItem, setNewItem] = useState({ name: '', url: '', quantity: 1 });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.guestGetItems(token);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.guestCreateItem(token, newItem);
      setNewItem({ name: '', url: '', quantity: 1 });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div>
      <div className="header">
        <h1>Guest Gift List</h1>
      </div>
      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}

        <h3>Current Gifts</h3>
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="item-info">
                <div className="name">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.name}
                    </a>
                  ) : (
                    item.name
                  )}
                  {item.is_purchased && <span className="badge badge-purchased">Purchased</span>}
                </div>
                <div className="meta">
                  {item.quantity > 1 && `× ${item.quantity}`}
                  {item.price && ` · $${item.price}`}
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && <div className="empty">No gifts added yet.</div>}
        </ul>

        <h3>Add a Gift</h3>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="guest-item-name">Gift Name</label>
              <input
                id="guest-item-name"
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="guest-item-url">Product URL (optional)</label>
              <input
                id="guest-item-url"
                type="url"
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="guest-item-qty">Quantity</label>
              <input
                id="guest-item-qty"
                type="number"
                min="1"
                value={newItem.quantity}
                onChange={(e) =>
                  setNewItem({ ...newItem, quantity: parseInt(e.target.value, 10) || 1 })
                }
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Gift'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GuestAddPage;
