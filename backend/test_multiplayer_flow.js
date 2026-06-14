import { io } from "socket.io-client";
import { execSync } from "child_process";

const BACKEND_URL = "http://localhost:4000";

// Users from DB:
// Host: f9c6b7b5-d607-4e6e-8efc-044288d15f95 (username: hostone)
// Guest: e65ce276-a0cf-4c7b-83b2-e2ec14db50ff (username: guestone)

const hostInfo = {
  userId: "f9c6b7b5-d607-4e6e-8efc-044288d15f95",
  username: "hostone",
  name: "Host One",
  image: null,
};

const guestInfo = {
  userId: "e65ce276-a0cf-4c7b-83b2-e2ec14db50ff",
  username: "guestone",
  name: "Guest One",
  image: null,
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("=== STARTING MULTIPLAYER SOCKET FLOW TEST ===");

  // 1. Connect Host
  console.log("Connecting Host socket...");
  const hostSocket = io(BACKEND_URL, { forceNew: true });
  
  await new Promise((resolve) => {
    hostSocket.on("connect", () => {
      console.log(`Host socket connected: ${hostSocket.id}`);
      resolve();
    });
  });

  // 2. Connect Guest
  console.log("Connecting Guest socket...");
  const guestSocket = io(BACKEND_URL, { forceNew: true });
  
  await new Promise((resolve) => {
    guestSocket.on("connect", () => {
      console.log(`Guest socket connected: ${guestSocket.id}`);
      resolve();
    });
  });

  let roomCode = null;

  // 3. Create room (Host)
  console.log("Host creating room...");
  await new Promise((resolve, reject) => {
    hostSocket.emit("create_room", { ...hostInfo, maxPlayers: 4 }, (res) => {
      if (res.ok) {
        roomCode = res.code;
        console.log(`Room created successfully with code: ${roomCode}`);
        resolve();
      } else {
        reject(new Error(`Failed to create room: ${res.error}`));
      }
    });
  });

  // Check Redis for the room
  console.log("Checking Redis room state after creation...");
  const redisKeysBefore = execSync(`docker exec keyarena-redis-1 redis-cli KEYS "room:${roomCode}"`).toString().trim();
  console.log(`Redis keys matching room:${roomCode}:`, redisKeysBefore);

  // Set up event listeners for Guest joining
  const playerJoinedPromise = new Promise((resolve) => {
    hostSocket.on("player_joined", (data) => {
      console.log(`[Host Event] player_joined: User ${data.player.username} joined. Player count: ${data.playerCount}`);
      resolve(data);
    });
  });

  // 4. Guest joins room
  console.log(`Guest joining room ${roomCode}...`);
  await new Promise((resolve, reject) => {
    guestSocket.emit("join_room", { code: roomCode, ...guestInfo }, (res) => {
      if (res.ok) {
        console.log(`Guest joined room successfully!`);
        resolve();
      } else {
        reject(new Error(`Failed to join room: ${res.error}`));
      }
    });
  });

  await playerJoinedPromise;

  // 5. Host starts the race
  console.log("Host starting race...");
  
  const countdownPromise = Promise.all([
    new Promise((resolve) => {
      hostSocket.on("countdown_start", (data) => {
        console.log(`[Host Event] countdown_start: Countdown ends at ${data.countdownEnd}`);
        resolve();
      });
    }),
    new Promise((resolve) => {
      guestSocket.on("countdown_start", (data) => {
        console.log(`[Guest Event] countdown_start: Countdown ends at ${data.countdownEnd}`);
        resolve();
      });
    }),
  ]);

  await new Promise((resolve, reject) => {
    hostSocket.emit("start_race", { code: roomCode, userId: hostInfo.userId }, (res) => {
      if (res.ok) {
        console.log("Race start requested successfully");
        resolve();
      } else {
        reject(new Error(`Failed to start race: ${res.error}`));
      }
    });
  });

  await countdownPromise;
  console.log("Countdown is running... waiting for race_start event (3s)...");

  const raceStartPromise = Promise.all([
    new Promise((resolve) => {
      hostSocket.on("race_start", (data) => {
        console.log(`[Host Event] race_start: Started at ${data.startedAt}. Passage: "${data.passage.substring(0, 40)}..."`);
        resolve();
      });
    }),
    new Promise((resolve) => {
      guestSocket.on("race_start", (data) => {
        console.log(`[Guest Event] race_start: Started at ${data.startedAt}. Passage: "${data.passage.substring(0, 40)}..."`);
        resolve();
      });
    }),
  ]);

  await raceStartPromise;
  console.log("Race started! Sending progress updates...");

  // Listen to progress updates
  hostSocket.on("progress_update", (data) => {
    console.log(`[Host Event] progress_update: User ${data.userId} -> Progress: ${data.progress}%, WPM: ${data.wpm}`);
  });

  guestSocket.on("progress_update", (data) => {
    console.log(`[Guest Event] progress_update: User ${data.userId} -> Progress: ${data.progress}%, WPM: ${data.wpm}`);
  });

  // 6. Send progress updates
  console.log("Sending Host progress: 50%");
  hostSocket.emit("player_progress", { code: roomCode, userId: hostInfo.userId, progress: 50, wpm: 75, accuracy: 98 });
  await sleep(500);

  console.log("Sending Guest progress: 40%");
  guestSocket.emit("player_progress", { code: roomCode, userId: guestInfo.userId, progress: 40, wpm: 65, accuracy: 95 });
  await sleep(500);

  console.log("Sending Host progress: 100%");
  hostSocket.emit("player_progress", { code: roomCode, userId: hostInfo.userId, progress: 100, wpm: 80, accuracy: 96 });
  await sleep(500);

  console.log("Sending Guest progress: 100%");
  guestSocket.emit("player_progress", { code: roomCode, userId: guestInfo.userId, progress: 100, wpm: 70, accuracy: 92 });
  await sleep(500);

  // Set up finish promises
  const finishPromise = Promise.all([
    new Promise((resolve) => {
      hostSocket.on("player_finish", (data) => {
        console.log(`[Host Event] player_finish: User ${data.userId} finished. Rank: #${data.rank}, WPM: ${data.wpm}`);
        resolve();
      });
    }),
    new Promise((resolve) => {
      guestSocket.on("player_finish", (data) => {
        console.log(`[Guest Event] player_finish: User ${data.userId} finished. Rank: #${data.rank}, WPM: ${data.wpm}`);
        resolve();
      });
    }),
  ]);

  const raceFinishedPromise = Promise.all([
    new Promise((resolve) => {
      hostSocket.on("race_finished", (data) => {
        console.log(`[Host Event] race_finished: Standings:`, JSON.stringify(data.standings, null, 2));
        resolve();
      });
    }),
    new Promise((resolve) => {
      guestSocket.on("race_finished", (data) => {
        console.log(`[Guest Event] race_finished received.`);
        resolve();
      });
    }),
  ]);

  // 7. Complete the race (Host finishes first)
  console.log("Host finishing race...");
  await new Promise((resolve, reject) => {
    hostSocket.emit("player_finished", {
      code: roomCode,
      userId: hostInfo.userId,
      wpm: 80,
      rawWpm: 85,
      accuracy: 96,
      timeTakenMs: 15000,
      keystrokeLog: [],
    }, (res) => {
      if (res.ok) {
        console.log(`Host finish recorded! Rank: #${res.rank}`);
        resolve();
      } else {
        reject(new Error(`Host finish failed: ${res.error}`));
      }
    });
  });

  // Guest finishes second
  console.log("Guest finishing race...");
  await new Promise((resolve, reject) => {
    guestSocket.emit("player_finished", {
      code: roomCode,
      userId: guestInfo.userId,
      wpm: 70,
      rawWpm: 72,
      accuracy: 92,
      timeTakenMs: 17000,
      keystrokeLog: [],
    }, (res) => {
      if (res.ok) {
        console.log(`Guest finish recorded! Rank: #${res.rank}`);
        resolve();
      } else {
        reject(new Error(`Guest finish failed: ${res.error}`));
      }
    });
  });

  await finishPromise;
  await raceFinishedPromise;
  console.log("Both players finished. Checking DB saves...");

  // Verify DB save
  const dbVerify = execSync(
    `docker exec keyarena-postgres-1 psql -U keyarena -c "SELECT user_id, wpm, accuracy, mode, room_code FROM race_sessions WHERE room_code = '${roomCode}' ORDER BY created_at DESC;"`
  ).toString();
  console.log("Database verification results:");
  console.log(dbVerify);

  // 8. Test disconnect handling
  console.log("Testing disconnect handling...");
  
  // Set up player left listener on Host
  const playerLeftPromise = new Promise((resolve) => {
    hostSocket.on("player_left", (data) => {
      console.log(`[Host Event] player_left: User ${data.userId} left. Player count remaining: ${data.playerCount}`);
      resolve();
    });
  });

  // Disconnect Guest socket
  console.log("Disconnecting Guest...");
  guestSocket.disconnect();

  await playerLeftPromise;
  console.log("Guest disconnect successfully detected by Host!");

  // Disconnect Host socket
  console.log("Disconnecting Host...");
  hostSocket.disconnect();
  await sleep(1000);

  // Verify Redis room cleanup
  console.log("Verifying Redis room key cleanup...");
  const redisKeysAfter = execSync(`docker exec keyarena-redis-1 redis-cli KEYS "room:${roomCode}"`).toString().trim();
  if (redisKeysAfter === "") {
    console.log(`SUCCESS: Room ${roomCode} successfully deleted from Redis after both players left.`);
  } else {
    console.warn(`WARNING: Room ${roomCode} still exists in Redis: ${redisKeysAfter}`);
  }

  console.log("=== MULTIPLAYER SOCKET FLOW TEST COMPLETED SUCCESSFULLY ===");
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
