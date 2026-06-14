"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket }   from "socket.io-client";
import type { RaceRoom, Player } from "@/types/race";

export type RoomPhase = "connecting" | "lobby" | "countdown" | "racing" | "finished" | "error";

interface UseRaceRoomOptions {
  code:     string;
  userId:   string;
  username: string;
  name:     string;
  image:    string | null;
}

export function useRaceRoom({ code, userId, username, name, image }: UseRaceRoomOptions) {
  const socketRef       = useRef<Socket | null>(null);
  const [phase,         setPhase]         = useState<RoomPhase>("connecting");
  const [room,          setRoom]          = useState<RaceRoom | null>(null);
  const [countdown,     setCountdown]     = useState<number>(3);
  const [error,         setError]         = useState<string>("");
  const [myRank,        setMyRank]        = useState<number | null>(null);
  const [standings,     setStandings]     = useState<Player[]>([]);
  const countdownTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  const socket = socketRef.current;

  // ── Connect + join room ────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
      transports: ["websocket", "polling"],
    });
    socketRef.current = s;

    s.on("connect", () => {
      // Join the room as soon as connected
      s.emit("join_room", { code, userId, username, name, image }, (res: {
        ok: boolean; room?: RaceRoom; error?: string;
      }) => {
        if (!res.ok) {
          setError(res.error ?? "Failed to join room");
          setPhase("error");
          return;
        }
        setRoom(res.room!);
        setPhase("lobby");
      });
    });

    s.on("connect_error", () => {
      setError("Could not connect to server");
      setPhase("error");
    });

    // ── Room events ────────────────────────────────────────────────────────
    s.on("player_joined", (data: { player: Player; playerCount: number }) => {
      setRoom((r) => {
        if (!r) return r;
        return { ...r, players: { ...r.players, [data.player.userId]: data.player } };
      });
    });

    s.on("player_left", (data: { userId: string; playerCount: number }) => {
      setRoom((r) => {
        if (!r) return r;
        const players = { ...r.players };
        delete players[data.userId];
        return { ...r, players };
      });
    });

    s.on("host_changed", (data: { newHostId: string }) => {
      setRoom((r) => r ? { ...r, hostId: data.newHostId } : r);
    });

    // ── Countdown ─────────────────────────────────────────────────────────
    s.on("countdown_start", (data: { countdownEnd: number; passage: string }) => {
      setPhase("countdown");
      setRoom((r) => r ? { ...r, passageText: data.passage, status: "countdown" } : r);

      // Tick down locally
      let remaining = Math.ceil((data.countdownEnd - Date.now()) / 1000);
      setCountdown(remaining);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = setInterval(() => {
        remaining -= 1;
        setCountdown(Math.max(0, remaining));
        if (remaining <= 0 && countdownTimer.current) {
          clearInterval(countdownTimer.current);
        }
      }, 1000);
    });

    // ── Race start ─────────────────────────────────────────────────────────
    s.on("race_start", (data: { startedAt: number; passage: string }) => {
      setPhase("racing");
      setRoom((r) => r ? { ...r, status: "racing", startedAt: data.startedAt } : r);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    });

    // ── Progress updates from other players ───────────────────────────────
    s.on("progress_update", (data: {
      userId: string; progress: number; wpm: number; accuracy: number;
    }) => {
      setRoom((r) => {
        if (!r || !r.players[data.userId]) return r;
        return {
          ...r,
          players: {
            ...r.players,
            [data.userId]: {
              ...r.players[data.userId],
              progress: data.progress,
              wpm:      data.wpm,
              accuracy: data.accuracy,
            },
          },
        };
      });
    });

    // ── Player finishes ────────────────────────────────────────────────────
    s.on("player_finish", (data: {
      userId: string; rank: number; wpm: number; accuracy: number; finishTime: number;
    }) => {
      if (data.userId === userId) setMyRank(data.rank);
      setRoom((r) => {
        if (!r || !r.players[data.userId]) return r;
        return {
          ...r,
          players: {
            ...r.players,
            [data.userId]: {
              ...r.players[data.userId],
              finished:   true,
              rank:       data.rank,
              wpm:        data.wpm,
              accuracy:   data.accuracy,
              finishTime: data.finishTime,
              progress:   100,
            },
          },
        };
      });
    });

    // ── All finished ───────────────────────────────────────────────────────
    s.on("race_finished", (data: { standings: Player[] }) => {
      setPhase("finished");
      setStandings(data.standings);
      setRoom((r) => r ? { ...r, status: "finished" } : r);
    });

    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      s.emit("leave_room", { code, userId });
      s.disconnect();
    };
  }, [code, userId, username, name, image]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const startRace = useCallback(() => {
    socketRef.current?.emit("start_race", { code, userId }, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setError(res.error ?? "Failed to start");
    });
  }, [code, userId]);

  const sendProgress = useCallback((progress: number, wpm: number, accuracy: number) => {
    socketRef.current?.emit("player_progress", { code, userId, progress, wpm, accuracy });
  }, [code, userId]);

  const sendFinished = useCallback((result: {
    wpm: number; rawWpm: number; accuracy: number; timeTakenMs: number; keystrokeLog?: object[];
  }) => {
    return new Promise<{ rank: number }>((resolve, reject) => {
      socketRef.current?.emit("player_finished", { code, userId, ...result }, (res: {
        ok: boolean; rank?: number; error?: string;
      }) => {
        if (res.ok && res.rank) resolve({ rank: res.rank });
        else reject(new Error(res.error ?? "Failed"));
      });
    });
  }, [code, userId]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("leave_room", { code, userId });
  }, [code, userId]);

  const isHost = room?.hostId === userId;
  const myPlayer = room?.players[userId] ?? null;
  const players  = room ? Object.values(room.players) : [];

  return {
    phase, room, players, myPlayer, countdown,
    error, myRank, standings, isHost,
    startRace, sendProgress, sendFinished, leaveRoom,
  };
}
