import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';

function DashboardPage() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', startDate: '', endDate: '' });
  const [newIndividual, setNewIndividual] = useState({ displayName: '', notes: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventsData, individualsData] = await Promise.all([
        api.getEvents(),
        api.getIndividuals(),
      ]);
      setEvents(eventsData.events || []);
      setIndividuals(individualsData.individuals || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateEvent(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.createEvent(newEvent);
      setNewEvent({ title: '', description: '', startDate: '', endDate: '' });
      setShowEventModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateIndividual(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.createIndividual(newIndividual);
      setNewIndividual({ displayName: '', notes: '' });
      setShowIndividualModal(false);
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
        <h1>Gift List</h1>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => setShowEventModal(true)}>
            + Event
          </button>
          <button className="btn btn-secondary" onClick={() => setShowIndividualModal(true)}>
            + Individual
          </button>
          <button className="btn btn-danger" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}

        <h2>My Events</h2>
        <div className="grid">
          {events.map((event) => (
            <div key={event.id} className="card">
              <h3>
                <Link to={`/events/${event.id}`}>{event.title}</Link>
              </h3>
              {event.description && <p>{event.description}</p>}
              <div className="meta">
                {event.start_date} → {event.end_date}
                {event.is_active ? ' · Active' : ' · Inactive'}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="empty">No events yet. Create your first event.</div>
          )}
        </div>

        <h2>Individuals</h2>
        <div className="grid">
          {individuals.map((ind) => (
            <div key={ind.id} className="card">
              <h3>{ind.display_name}</h3>
              {ind.notes && <p>{ind.notes}</p>}
              <div className="meta">
                Owner: {ind.owner_id === user.id ? 'You' : 'Other'}
              </div>
            </div>
          ))}
          {individuals.length === 0 && (
            <div className="empty">No individuals yet. Add someone.</div>
          )}
        </div>

        {showEventModal && (
          <div className="card">
            <h3>Create Event</h3>
            <form onSubmit={handleCreateEvent}>
              <div>
                <label htmlFor="event-title">Title</label>
                <input
                  id="event-title"
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="event-desc">Description</label>
                <input
                  id="event-desc"
                  type="text"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="event-start">Start Date</label>
                <input
                  id="event-start"
                  type="date"
                  value={newEvent.startDate}
                  onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="event-end">End Date</label>
                <input
                  id="event-end"
                  type="date"
                  value={newEvent.endDate}
                  onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Create
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEventModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showIndividualModal && (
          <div className="card">
            <h3>Create Individual</h3>
            <form onSubmit={handleCreateIndividual}>
              <div>
                <label htmlFor="ind-name">Display Name</label>
                <input
                  id="ind-name"
                  type="text"
                  value={newIndividual.displayName}
                  onChange={(e) => setNewIndividual({ ...newIndividual, displayName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="ind-notes">Notes</label>
                <textarea
                  id="ind-notes"
                  value={newIndividual.notes}
                  onChange={(e) => setNewIndividual({ ...newIndividual, notes: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Create
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowIndividualModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
