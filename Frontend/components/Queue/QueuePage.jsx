import { useCallback, useEffect, useRef, useState } from 'react';
import { listQueue, checkInQueue, callNextPatient, cancelQueueEntry } from '../../lib/api';
import './queue.css';

function statusMessage(entry) {
  switch (entry.status) {
    case 'WAITING': return `Please wait. There are ${entry.patientsAhead} patients ahead of you.`;
    case 'SERVING': return 'It is your turn. Please proceed to the consultation area.';
    case 'COMPLETED': return 'Your consultation has been completed.';
    case 'CANCELLED': return 'Your queue has been cancelled.';
    default: return '';
  }
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
    refresh();
    const timer = staff ? null : window.setInterval(() => {
      if (!actionPending.current) refresh();
    }, 5000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      requestRef.current?.abort();
    };
  }, [refresh, staff]);

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
      <div className="queue-actions">
        {staff && <button disabled={busy || loading} onClick={() => act(() => callNextPatient(userId))}>Call Next Patient</button>}
        <button disabled={busy} onClick={refresh}>{staff ? 'Refresh Queue' : 'Refresh'}</button>
        <span>{updatedAt ? `Last refreshed ${updatedAt.toLocaleTimeString()}` : 'Loading queue…'}</span>
      </div>
      {error && <p role="alert" className="queue-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {staff ? <>
        <article className={cardClass}>
          <h3>Currently Serving</h3>
          {data.current ? <>
            <strong className="queue-number">{data.current.queueNumber}</strong>
            <p>Pet: {data.current.petName}</p><p>Owner: {data.current.ownerName}</p><p>Status: {data.current.status}</p>
          </> : <p>No patient is currently being served.</p>}
        </article>
        <article className={cardClass}>
          <h3>Waiting Queue</h3>
          <div className="queue-table-wrap"><table>
            <thead><tr><th>Queue</th><th>Pet</th><th>Owner</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{waiting.map((entry) => <tr key={entry.id}>
              <td>{entry.queueNumber}</td><td>{entry.petName}</td><td>{entry.ownerName}</td><td>{entry.status}</td>
              <td><button disabled={busy} onClick={() => act(() => cancelQueueEntry(userId, entry.id))}>Cancel</button></td>
            </tr>)}</tbody>
          </table></div>
          {!loading && !waiting.length && <p>No patients waiting.</p>}
        </article>
      </> : <>
        <form className={cardClass} onSubmit={(event) => { event.preventDefault(); act(() => checkInQueue(userId, selectedPetId)); }}>
          <h3>Check In</h3>
          <label htmlFor="queue-pet">Pet</label>
          <div className="queue-actions">
            <select id="queue-pet" value={selectedPetId} onChange={(event) => setPetId(event.target.value)} disabled={busy || loading || !availablePets.length} required>
              {!availablePets.length && <option value="">No pets available for check-in</option>}
              {availablePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
            </select>
            <button disabled={busy || loading || !selectedPetId}>Check In</button>
          </div>
          {!pets.length && <p>Add a pet in My Pets to check in.</p>}
        </form>
        <article className={cardClass}>
          <h3>Your Queue Status</h3>
          {data.queue.length > 1 && <label>Choose a visit
            <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>
              {[...data.queue].reverse().map((entry) => <option key={entry.id} value={entry.id}>{entry.queueNumber} — {entry.petName} ({entry.status})</option>)}
            </select>
          </label>}
          {selected ? <>
            <div className="queue-metrics">
              <div>Your Queue Number<strong className="queue-number">{selected.queueNumber}</strong></div>
              <div>Currently Serving<strong>{data.current?.queueNumber || 'None'}</strong></div>
              <div>Patients Ahead<strong>{selected.patientsAhead}</strong></div>
              <div>Status<strong>{selected.status}</strong></div>
            </div>
            <p>Pet: {selected.petName}</p>
            <p role="status">{statusMessage(selected)}</p>
            {selected.status === 'WAITING' && <button disabled={busy} onClick={() => act(() => cancelQueueEntry(userId, selected.id))}>Cancel Queue</button>}
          </> : <p>{loading ? 'Loading queue…' : 'Check in your pet to receive a queue number.'}</p>}
          <p>Queue status refreshes every 5 seconds.</p>
        </article>
      </>}
    </section>
  );
}
