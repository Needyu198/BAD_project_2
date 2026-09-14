# Veterinary queue

The queue uses the existing Express REST API, PostgreSQL pool, and React dashboard navigation. It adds no packages, WebSocket connections, or Socket.IO. Existing appointments and consultations remain independent from queue status.

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
VITE_API_BASE_URL=http://localhost:5001 npm run dev
```

Open http://localhost:5173 (or the URL Vite prints). The frontend defaults to backend port 5001; the server defaults to 5000 if PORT is omitted, so keep these settings aligned.

## Exact manual test

Use a fresh queue table in a development database to obtain literal A001 and A002. Existing queue history is deliberately retained; numbers continue from the last issued number. Do not reset a database containing real clinic data.

1. Sign in as a pet owner. In **My Pets**, register two pets, for example Milo and Coco, if needed.
2. Open **Queue Status**, select Milo, and click **Check In**. Verify **A001**, **WAITING**, and **0** patients ahead.
3. Select Coco and click **Check In**. Verify **A002**, **WAITING**, and **1** patient ahead. The visit selector lets you revisit A001.
4. In a second browser tab, sign in as a staff account. Open **Queue Management**. Verify A001 then A002 in the waiting table, including pet and owner names.
5. Click **Call Next Patient** once. Verify **A001** is currently **SERVING** and A002 remains **WAITING**. In the owner tab, wait up to five seconds or click **Refresh**; A001 shows the proceed-to-consultation message. A002 has **0** waiting patients ahead because the serving patient is excluded.
6. Click **Call Next Patient** again. Verify staff's currently serving number is **A002**.
7. In the owner tab, select A001 and refresh. Verify **COMPLETED** and the completion message. Select A002 and verify **SERVING** and the proceed-to-consultation message.
8. Click **Call Next Patient** once more. A002 completes, no patient is serving, and the response message is **No patients waiting**.
9. Check in another pet and cancel it while WAITING. Verify **CANCELLED**, removal from staff's waiting table after refresh, and the cancellation message. SERVING and terminal entries cannot be cancelled.
10. For the requested count example, leave one patient SERVING, then check in three other pets. The last WAITING pet has **2** patients ahead. Cancelling an earlier WAITING entry reduces this count.
11. Navigate away from the owner queue page. Its five-second polling timer is cleared, and pending reads are aborted.

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

Numbers are database-generated, monotonically increasing, and never reset daily. They start at A001 and expand beyond A999. Database identities may have gaps after rolled-back inserts. A transaction-wide advisory lock serializes check-ins, next calls, and cancellations; partial unique indexes enforce one SERVING patient and one active entry per pet. Each accepted next request advances one patient, so two simultaneous staff calls advance twice in sequence while retaining only one SERVING row. The UI disables actions during an in-flight action to prevent double clicks.

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
