"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Singleton — reuse existing connection
    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
        transports:       ["websocket", "polling"],
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 10000,
      });
    }
    socketRef.current = globalSocket;

    return () => {
      // Don't disconnect on component unmount — keep alive for the session
    };
  }, []);

  const emit = useCallback(<T = unknown>(event: string, data?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }
      if (data !== undefined) {
        socketRef.current.emit(event, data, (res: T) => resolve(res));
      } else {
        socketRef.current.emit(event, (res: T) => resolve(res));
      }
    });
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => { socketRef.current?.off(event, handler); };
  }, []);

  const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  return {
    socket:    socketRef,
    emit,
    on,
    off,
    connected: socketRef.current?.connected ?? false,
  };
}
