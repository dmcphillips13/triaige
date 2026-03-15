"use client";

import { useEffect, useRef } from "react";

export interface TriaigeEvent {
  type: "run_created" | "run_closed";
  run_id: string;
  repo?: string;
}

/**
 * Subscribe to SSE events from the runner via the dashboard proxy.
 * Calls `onEvent` when a run_created or run_closed event arrives.
 * Reconnects on tab refocus (old connection may have timed out).
 */
export function useTriaigeEvents(onEvent: (event: TriaigeEvent) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;

    function connect() {
      es = new EventSource("/api/runner/events");

      const handler = (type: string) => (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          callbackRef.current({ type: type as TriaigeEvent["type"], ...data });
        } catch {
          // ignore malformed events
        }
      };

      es.addEventListener("run_created", handler("run_created"));
      es.addEventListener("run_closed", handler("run_closed"));
    }

    connect();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Reconnect — old connection may have timed out
        es?.close();
        connect();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      es?.close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
