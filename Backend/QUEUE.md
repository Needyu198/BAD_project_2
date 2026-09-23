# Veterinary queue with Socket.IO

The queue uses PostgreSQL as the source of truth, Express REST endpoints for reads and mutations, and Socket.IO for real-time notifications. Socket.IO attempts a WebSocket connection first and can fall back to HTTP long-polling when a proxy or network does not support WebSocket. Existing appointments and consultations remain independent from queue status.

## How the real-time flow works

```text
Staff/owner action
      |
      v
Express REST endpoint -----> PostgreSQL transaction
      |                              |
      | successful commit            | authoritative queue state
      v                              |
Socket.IO emits queue:updated        |
      |                              |
      v                              |
All QueuePage clients re-fetch ------+
their permitted REST snapshot
```

The socket event contains only `change`, `entryId`, and `changedAt`. It deliberately does not contain owner or pet information. Staff and pet owners receive the same change signal, but the subsequent REST response is still scoped by the existing `userId` and role checks.

## Setup and run

From the project root:

```sh
cd Backend
npm ci
```

Ensure `Backend/.env` contains a working `DATABASE_URL` (or `POSTGRES_URL`) and `PORT=5001`. See `.env.example` for the existing configuration format. Then:

```sh
npm run db:migrate
npm run dev
```

The migration runner applies the existing initial schema and the idempotent `002_queue.sql`. Existing data is retained. Queue entries reference `users` and `pets`; names are read from those relationships. If a pet or user is deleted through existing features, its queue reference becomes null and history remains with a “Deleted pet/owner” label.

In a second terminal, from the project root:

```sh
cd Frontend
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173 (or the URL Vite prints). The frontend defaults to backend port 5001; the server defaults to 5000 if PORT is omitted, so keep these settings aligned.

The browser console's Network tab shows a connection under `WS` at `/socket.io/`. The queue page also displays `Real-time: connected`. If the socket disconnects temporarily, Socket.IO reconnects automatically and a 30-second safety refresh keeps the page from becoming permanently stale.

## Socket.IO setup, step by step

1. Install `socket.io` in `Backend` and `socket.io-client` in `Frontend`.
2. Create a Node HTTP server from the Express app in `Backend/src/sever.js`.
3. Attach `new Server(httpServer, ...)` to that same HTTP server. REST and Socket.IO therefore share one host and port.
4. Configure the same allowed frontend origins for Express CORS and Socket.IO CORS.
5. Register connections in `Backend/src/realtime/queueSocket.js`; every queue page joins the `queue` room.
6. After a successful check-in, next-patient call, or cancellation, emit `queue:updated` from the controller.
7. Connect the React page with `socket.io-client`, listen for `queue:updated`, and call the existing `listQueue` REST API.
8. Remove the listener and disconnect the socket when the component unmounts so navigation does not create duplicate connections.

Important distinction for an explanation: WebSocket is the low-level, full-duplex transport. Socket.IO is a higher-level real-time library that can use WebSocket, adds named events such as `queue:updated`, reconnects automatically, supports rooms, and can fall back to HTTP long-polling. A raw WebSocket client cannot connect directly to a Socket.IO server because the Socket.IO protocol adds its own handshake and message format.

For multiple backend server instances, replace the in-memory Socket.IO room broadcast with the Socket.IO Redis adapter so an event created on one instance reaches clients connected to every instance.

## Daily reset

Queue numbers restart at **A001** at the start of each local day. A "day" is the calendar date of an entry's `created_at` in the `QUEUE_TIMEZONE` zone (defaults to `Asia/Seoul`; set it in `Backend/.env`). At local midnight the next check-in becomes A001 again, and the previous day's numbers are frozen as history. The queue page reflects this automatically: connected clients receive the periodic safety refresh and any `queue:updated` event, so the first check-in after midnight shows A001 without a manual reload.

No scheduled job or database reset is required. Numbering is derived per day from each entry's local creation date, so history is preserved and nothing is deleted. Calling the next patient and the "patients ahead" count are scoped to the current day, so a `WAITING` entry left uncalled from a previous day is never pulled into or counted against the new day. If a patient was still `SERVING` when the day rolled over, it is no longer shown as the current patient on the new day and is completed the next time staff calls the next patient.

## Exact manual test

Use a fresh queue table in a development database, and run the test within a single local day, to obtain literal A001 and A002. Within a day, numbers increase from the first check-in; they restart at A001 on the next local day. Do not reset a database containing real clinic data.

1. Sign in as a pet owner. In **My Pets**, register two pets, for example Milo and Coco, if needed.
2. Open **Queue Status**, select Milo, and click **Check In**. Verify **A001**, **WAITING**, and **0** patients ahead.
3. Select Coco and click **Check In**. Verify **A002**, **WAITING**, and **1** patient ahead. The visit selector lets you revisit A001.
4. In a second browser tab, sign in as a staff account. Open **Queue Management**. Verify A001 then A002 in the waiting table, including pet and owner names.
5. Click **Call Next Patient** once. Verify **A001** is currently **SERVING** and A002 remains **WAITING**. The owner tab should update immediately without a manual refresh; A001 shows the proceed-to-consultation message. A002 has **0** waiting patients ahead because the serving patient is excluded.
6. Click **Call Next Patient** again. Verify staff's currently serving number is **A002**.
7. In the owner tab, select A001 and refresh. Verify **COMPLETED** and the completion message. Select A002 and verify **SERVING** and the proceed-to-consultation message.
8. Click **Call Next Patient** once more. A002 completes, no patient is serving, and the response message is **No patients waiting**.
9. Check in another pet and cancel it while WAITING. Verify **CANCELLED**, removal from staff's waiting table after refresh, and the cancellation message. SERVING and terminal entries cannot be cancelled.
10. For the requested count example, leave one patient SERVING, then check in three other pets. The last WAITING pet has **2** patients ahead. Cancelling an earlier WAITING entry reduces this count.
11. Navigate away from the owner queue page. Its Socket.IO listener, connection, safety timer, and pending reads are cleaned up.

## API

All endpoints require `?userId=<existing-user-id>`, following the project's existing account-ID convention. The server looks up the role, restricts next/list access to the appropriate role, checks pet ownership, and scopes owner reads/cancellations. **The current application has no authenticated server session or token. A caller can impersonate another account by supplying its ID. These checks are not secure authentication.** This feature preserves that existing architecture; production authentication would require a separate application-wide change.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/queue/check-in?userId=OWNER_ID` | Body `{"petId":"PET_ID"}`; returns `{entry}` with HTTP 201 |
| GET | `/api/queue?userId=USER_ID` | `{queue, current}`; staff sees all entries, owners see their own entries and only the current serving number |
| GET | `/api/queue/current?userId=USER_ID` | `{current: {queueNumber}}` or `{current: null}` |
| GET | `/api/queue/ENTRY_ID?userId=USER_ID` | `{entry, current}`; owner-scoped |
| POST | `/api/queue/next?userId=STAFF_ID` | `{entry}` or `{"message":"No patients waiting"}` |
| PATCH | `/api/queue/ENTRY_ID/cancel?userId=USER_ID` | `{entry}`; WAITING only |

Each entry includes `id`, `queueNumber`, `ownerId`, `petId`, `ownerName`, `petName`, `status`, `patientsAhead`, `createdAt`, `calledAt`, and `completedAt`.

Numbers restart at A001 each local day (see [Daily reset](#daily-reset)). Within a day they are derived from the database-generated, monotonically increasing `ticket_number`, so they are ordered and stable. The underlying `ticket_number` never resets and remains the global history key; only the displayed per-day `queueNumber` restarts. Database identities may have gaps after rolled-back inserts, but the per-day display rank is contiguous (A001, A002, …). A transaction-wide advisory lock serializes check-ins, next calls, and cancellations; partial unique indexes enforce one SERVING patient and one active entry per pet. Each accepted next request advances one patient, so two simultaneous staff calls advance twice in sequence while retaining only one SERVING row. The UI disables actions during an in-flight action to prevent double clicks.

## Automated verification

Use an explicit local/test database connection with schema creation permissions:

```sh
cd Backend
QUEUE_TEST_DATABASE_URL=postgresql://localhost/postgres node --test tests/queue.integration.test.js
```

The test creates a uniquely named schema, runs migrations and the actual REST router, checks A001/A002 transitions, timestamps, counting, cancellation, role/owner filtering, duplicate concurrent check-ins, concurrent next calls, empty queues, and the database single-serving constraint, then removes only its own test schema. It does not load `Backend/.env`. Without `QUEUE_TEST_DATABASE_URL`, the test is skipped.

Frontend build:

```sh
cd Frontend
npm run build
```
