# 500 participant competition load test

Run this only against a local KeyArena backend and its matching development database/Redis. The test creates a temporary competition and 501 temporary users, registers 500 through the real registration API, probes that the full event rejects another racer, joins 500 Socket.IO clients, sends progress, finishes the race, and checks the final board and saved race results.

```powershell
cd D:\projects\keyArena\backend
npm run test:competition-load
```

The script defaults to `http://localhost:4000` and 500 racers. It refuses non-local backend URLs. Optional environment settings:

```powershell
$env:LOAD_TEST_PARTICIPANTS = "500"
$env:LOAD_TEST_BACKEND_URL = "http://localhost:4000"
npm run test:competition-load
```

Each run writes a JSON report and a readable Markdown summary into this folder. Reports include per-phase latency, success counts, leaderboard checks, result persistence, and (on Windows) sampled backend process CPU time and working-set memory. The script removes its temporary competition, registrations, users, race sessions, and Redis leaderboard keys in a `finally` cleanup path.

## Recorded run

The final local 500-racer run passed every check, including cleanup verification: [Markdown report](2026-10-26T17-28-21-768Z-83eb49ba.md) and [JSON report](2026-10-26T17-28-21-768Z-83eb49ba.json). It registered and connected 500 clients, retained all 500 in the room, delivered start and live updates to all clients, saved all 500 race results, sent the final leaderboard event to all clients, and returned a correctly ordered top 100 from the leaderboard API.

For a production-mode container run from PowerShell, start the isolated stack:

```powershell
cd D:\projects\keyArena
docker compose -p keyarena-loadtest -f docker-compose.loadtest.yml up -d --build
```

Apply the current frontend schema to its empty database, then run the test using that stack:

```powershell
cd D:\projects\keyArena\frontend
$env:DATABASE_URL = "postgresql://keyarena:keyarena@127.0.0.1:15432/keyarena"
npx drizzle-kit push

cd D:\projects\keyArena
$env:LOAD_TEST_BACKEND_URL = "http://127.0.0.1:4001"
$env:LOAD_TEST_DOCKER_CONTAINER = "keyarena-loadtest-backend-1"
$env:DATABASE_URL = "postgresql://keyarena:keyarena@127.0.0.1:15432/keyarena"
$env:REDIS_URL = "redis://127.0.0.1:16379"
$env:LOAD_TEST_HTTP_CONCURRENCY = "40"
npm --prefix backend run test:competition-load
```

Stop the isolated test stack after the run:

```powershell
docker compose -p keyarena-loadtest -f docker-compose.loadtest.yml down
```

These services use independent temporary storage (Postgres and Redis data are discarded on shutdown). Backend resource limits are 2 CPU / 1 GiB; Postgres is 2 CPU / 1 GiB; Redis is 1 CPU / 512 MiB. The 500 Socket.IO connections and race events remain concurrent; only HTTP registrations are issued in batches of 40 to avoid a host-to-Docker connection burst.

## Production-mode container run

The isolated production-mode container run passed all 500 participant checks and verified cleanup: [Markdown report](2026-10-26T17-40-57-494Z-e921839a.md) and [JSON report](2026-10-26T17-40-57-494Z-e921839a.json). The backend used a peak 256.2 MiB of its 1 GiB limit and sampled peak CPU at 175.3% (about 1.75 cores of its 2-core limit). Registration p95 was 77.8 ms; socket join acknowledgement p95 was 1,521.3 ms. All 500 clients received race start, live leaderboard updates, and final leaderboard events, and 500 results were persisted before cleanup.

Earlier failed reports are retained as regression evidence. For example, the [pre-fix join race report](2026-10-26T17-12-00-922Z-9e96c738.md) recorded 500 successful join acknowledgements but only 35 racers retained in Redis; the atomic room update was added afterward.

## Interpreting the evidence

A passing local run demonstrates that this specific development stack completed the tested flow with 500 simulated clients. It is not by itself a production capacity certification: production hardware, database/Redis configuration, deployment topology, network latency, and real-browser behavior can change the result. Keep the report with the environment and commit used for each run; repeat the test against a production-like staging deployment before promising a 500-person event.
