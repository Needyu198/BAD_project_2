import { useCallback, useEffect, useRef, useState } from 'react';
import { listQueue, checkInQueue, callNextPatient, cancelQueueEntry } from '../../lib/api';
import { connectQueueSocket } from '../../lib/queueSocket';
import './queue.css';

const STATUS_META = {
  WAITING: { label: 'Waiting', tone: 'waiting' },
  SERVING: { label: 'In consultation', tone: 'serving' },
  COMPLETED: { label: 'Completed', tone: 'completed' },
  CANCELLED: { label: 'Cancelled', tone: 'cancelled' },
};

function statusLabel(status) {
  return STATUS_META[status]?.label || status;
}

function StatusBadge({ status }) {
  const tone = STATUS_META[status]?.tone || 'default';
  return <span className={`queue-badge queue-badge--${tone}`}>{statusLabel(status)}</span>;
}

function statusMessage(entry) {
  switch (entry.status) {
    case 'WAITING':
      if (entry.patientsAhead === 0) return "You're next in line. Please stay nearby.";
      if (entry.patientsAhead === 1) return 'Almost there — 1 patient is ahead of you.';
      return `Please wait. There are ${entry.patientsAhead} patients ahead of you.`;
    case 'SERVING': return "It's your turn. Please proceed to the consultation area.";
    case 'COMPLETED': return 'Your consultation has been completed. Thank you for visiting.';
    case 'CANCELLED': return 'This check-in was cancelled.';
    default: return '';
  }
}

const REALTIME_META = {
  connected: { label: 'Live', tone: 'online' },
  connecting: { label: 'Connecting…', tone: 'pending' },
  disconnected: { label: 'Reconnecting…', tone: 'offline' },
};

function RealtimeIndicator({ status }) {
  const meta = REALTIME_META[status] || REALTIME_META.connecting;
  return (
    <span className={`queue-live queue-live--${meta.tone}`} role="status">
      <span className="queue-live-dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function QueuePage({ currentUser, staff = false, pets = [] }) {
  const [data, setData] = useState({ queue: [], current: null });
  const [petId, setPetId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const requestRef = useRef(null);
  const mounted = useRef(false);
  const actionPending = useRef(false);
  const userId = currentUser?.id;
  const cardClass = staff ? 'st-card' : 'po-card';

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await listQueue(userId, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setData(response);
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      if (mounted.current && !controller.signal.aborted) setError(err.message);
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    setRealtimeStatus('connecting');
    refresh();

    const socket = connectQueueSocket();
    const handleQueueUpdate = () => {
      if (!actionPending.current) refresh();
    };
    const handleConnect = () => setRealtimeStatus('connected');
    const handleDisconnect = () => setRealtimeStatus('disconnected');
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('queue:updated', handleQueueUpdate);

    // Safety-net refresh in case a proxy or temporary network issue blocks sockets.
    const timer = window.setInterval(() => {
      if (!actionPending.current) refresh();
    }, 30000);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      requestRef.current?.abort();
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.off('queue:updated', handleQueueUpdate);
      socket.disconnect();
    };
  }, [refresh]);

  async function act(action) {
    if (actionPending.current) return;
    actionPending.current = true;
    requestRef.current?.abort();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await action();
      if (!mounted.current) return;
      if (response.entry) setSelectedId(response.entry.id);
      setMessage(response.message || 'Queue updated.');
      await refresh();
    } catch (err) {
      if (mounted.current) {
        await refresh();
        setError(err.message);
      }
    } finally {
      actionPending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const waiting = data.queue.filter((entry) => entry.status === 'WAITING');
  const selected = data.queue.find((entry) => entry.id === selectedId)
    || data.queue.find((entry) => ['WAITING', 'SERVING'].includes(entry.status))
    || data.queue[data.queue.length - 1];
  const availablePets = pets.filter((pet) => !data.queue.some((entry) => entry.petId === pet.id && ['WAITING', 'SERVING'].includes(entry.status)));
  const selectedPetId = availablePets.some((pet) => pet.id === petId) ? petId : availablePets[0]?.id || '';

  return (
    <section className="queue-page" aria-label={staff ? 'Queue Management' : 'Queue Status'}>
      <header className="queue-topbar">
        <div className="queue-topbar-main">
          <h2 className="queue-title">{staff ? 'Queue Management' : 'Queue Status'}</h2>
          <p className="queue-subtitle">
            {staff
              ? 'Call the next patient and manage the waiting list in real time.'
              : 'Check in your pet and follow your place in line as it updates live.'}
          </p>
        </div>
        <div className="queue-topbar-meta">
          <RealtimeIndicator status={realtimeStatus} />
          <span className="queue-updated">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Loading…'}
          </span>
        </div>
      </header>

      <div className="queue-actions">
        {staff && (
          <button
            className="queue-btn queue-btn--primary"
            disabled={busy || loading || !waiting.length}
            onClick={() => act(() => callNextPatient(userId))}
          >
            {busy ? 'Working…' : 'Call Next Patient'}
          </button>
        )}
        <button className="queue-btn queue-btn--ghost" disabled={busy} onClick={refresh}>
          {staff ? 'Refresh Queue' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" className="queue-note queue-note--error">{error}</p>}
      {message && <p role="status" className="queue-note queue-note--success">{message}</p>}

      {staff ? (
        <>
          <article className={`${cardClass} queue-serving-card`}>
            <div className="queue-card-head">
              <h3>Currently Serving</h3>
              {data.current && <StatusBadge status={data.current.status} />}
            </div>
            {data.current ? (
              <div className="queue-serving-body">
                <strong className="queue-number queue-number--hero">{data.current.queueNumber}</strong>
                <dl className="queue-detail-list">
                  <div><dt>Pet</dt><dd>{data.current.petName}</dd></div>
                  <div><dt>Owner</dt><dd>{data.current.ownerName}</dd></div>
                </dl>
              </div>
            ) : (
              <div className="queue-empty">
                <p className="queue-empty-title">No patient is being served.</p>
                <p className="queue-empty-hint">Press “Call Next Patient” to start the next consultation.</p>
              </div>
            )}
          </article>

          <article className={cardClass}>
            <div className="queue-card-head">
              <h3>Waiting Queue</h3>
              <span className="queue-count-pill">{waiting.length} waiting</span>
            </div>
            {waiting.length ? (
              <div className="queue-table-wrap">
                <table>
                  <thead>
                    <tr><th>Queue</th><th>Pet</th><th>Owner</th><th>Status</th><th className="queue-col-action">Action</th></tr>
                  </thead>
                  <tbody>
                    {waiting.map((entry) => (
                      <tr key={entry.id}>
                        <td><span className="queue-number queue-number--sm">{entry.queueNumber}</span></td>
                        <td>{entry.petName}</td>
                        <td>{entry.ownerName}</td>
                        <td><StatusBadge status={entry.status} /></td>
                        <td className="queue-col-action">
                          <button
                            className="queue-btn queue-btn--danger queue-btn--sm"
                            disabled={busy}
                            onClick={() => act(() => cancelQueueEntry(userId, entry.id))}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !loading && (
                <div className="queue-empty">
                  <p className="queue-empty-title">No patients waiting.</p>
                  <p className="queue-empty-hint">New check-ins will appear here automatically.</p>
                </div>
              )
            )}
          </article>
        </>
      ) : (
        <>
          <form
            className={cardClass}
            onSubmit={(event) => { event.preventDefault(); act(() => checkInQueue(userId, selectedPetId)); }}
          >
            <div className="queue-card-head">
              <h3>Check In</h3>
            </div>
            <label className="queue-field-label" htmlFor="queue-pet">Which pet is visiting?</label>
            <div className="queue-checkin-row">
              <select
                id="queue-pet"
                className="queue-select"
                value={selectedPetId}
                onChange={(event) => setPetId(event.target.value)}
                disabled={busy || loading || !availablePets.length}
                required
              >
                {!availablePets.length && <option value="">No pets available for check-in</option>}
                {availablePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
              <button className="queue-btn queue-btn--primary" disabled={busy || loading || !selectedPetId}>
                {busy ? 'Checking in…' : 'Check In'}
              </button>
            </div>
            {!pets.length
              ? <p className="queue-hint">Add a pet in <strong>My Pets</strong> to check in.</p>
              : !availablePets.length && <p className="queue-hint">All your pets are already in the queue.</p>}
          </form>

          <article className={cardClass}>
            <div className="queue-card-head">
              <h3>Your Queue Status</h3>
              {selected && <StatusBadge status={selected.status} />}
            </div>

            {data.queue.length > 1 && (
              <label className="queue-field-label queue-visit-picker">
                Choose a visit
                <select
                  className="queue-select"
                  value={selected?.id || ''}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {[...data.queue].reverse().map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.queueNumber} — {entry.petName} ({statusLabel(entry.status)})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selected ? (
              <>
                <div className="queue-metrics">
                  <div className="queue-metric queue-metric--highlight">
                    <span>Your Queue Number</span>
                    <strong className="queue-number">{selected.queueNumber}</strong>
                  </div>
                  <div className="queue-metric">
                    <span>Now Serving</span>
                    <strong>{data.current?.queueNumber || '—'}</strong>
                  </div>
                  <div className="queue-metric">
                    <span>Patients Ahead</span>
                    <strong>{selected.status === 'WAITING' ? selected.patientsAhead : '—'}</strong>
                  </div>
                  <div className="queue-metric">
                    <span>Status</span>
                    <strong>{statusLabel(selected.status)}</strong>
                  </div>
                </div>
                <p className="queue-status-line" role="status">{statusMessage(selected)}</p>
                {selected.status === 'WAITING' && (
                  <button
                    className="queue-btn queue-btn--danger"
                    disabled={busy}
                    onClick={() => act(() => cancelQueueEntry(userId, selected.id))}
                  >
                    Cancel Queue
                  </button>
                )}
              </>
            ) : (
              <div className="queue-empty">
                <p className="queue-empty-title">
                  {loading ? 'Loading your queue…' : 'You are not in the queue yet.'}
                </p>
                {!loading && <p className="queue-empty-hint">Check in your pet above to receive a queue number.</p>}
              </div>
            )}
            <p className="queue-hint queue-hint--muted">This page updates automatically in real time.</p>
          </article>
        </>
      )}
    </section>
  );
}
