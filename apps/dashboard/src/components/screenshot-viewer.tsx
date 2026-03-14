// Screenshot comparison viewer with three modes: side-by-side, swipe slider,
// and diff overlay. Renders base64 PNG screenshots as data URIs.
//
// Compact view in the failure card with click-to-expand fullscreen modal.

"use client";

import { useEffect, useState } from "react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "side-by-side" | "swipe" | "diff";

export function ScreenshotViewer({
  baseline,
  actual,
  diffOverlay,
}: {
  baseline: string;
  actual: string;
  diffOverlay?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("side-by-side");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  const baselineSrc = `data:image/png;base64,${baseline}`;
  const actualSrc = `data:image/png;base64,${actual}`;
  const diffSrc = diffOverlay ? `data:image/png;base64,${diffOverlay}` : null;

  const modeTabs = (
    <div className="flex gap-1">
      {(["side-by-side", "swipe", "diff"] as Mode[]).map((m) => {
        const disabled = m === "diff" && !diffSrc;
        return (
          <button
            key={m}
            onClick={() => !disabled && setMode(m)}
            disabled={disabled}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === m
                ? "bg-zinc-200 text-zinc-900"
                : disabled
                  ? "cursor-not-allowed text-zinc-300"
                  : "text-zinc-500 hover:bg-zinc-100"
            )}
          >
            {m === "side-by-side"
              ? "Side by Side"
              : m === "swipe"
                ? "Swipe"
                : "Diff Overlay"}
          </button>
        );
      })}
    </div>
  );

  const viewerContent = (maxHeight: string) => (
    <div className="overflow-hidden rounded-md border border-zinc-200">
      {mode === "side-by-side" && (
        <div className="flex gap-px bg-zinc-200">
          <div className="flex-1 bg-white p-2">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Baseline
            </span>
            <img
              src={baselineSrc}
              alt="Baseline screenshot"
              className={`${maxHeight} w-full object-contain`}
            />
          </div>
          <div className="flex-1 bg-white p-2">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Actual
            </span>
            <img
              src={actualSrc}
              alt="Actual screenshot"
              className={`${maxHeight} w-full object-contain`}
            />
          </div>
        </div>
      )}

      {mode === "swipe" && (
        <div className="bg-white p-2">
          <ReactCompareSlider
            itemOne={
              <img
                src={baselineSrc}
                alt="Baseline screenshot"
                className={`${maxHeight} w-full object-contain`}
              />
            }
            itemTwo={
              <img
                src={actualSrc}
                alt="Actual screenshot"
                className={`${maxHeight} w-full object-contain`}
              />
            }
          />
        </div>
      )}

      {mode === "diff" && diffSrc && (
        <div className="bg-white p-2">
          <img
            src={diffSrc}
            alt="Diff overlay"
            className={`${maxHeight} w-full object-contain`}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Screenshots
          </h4>
          <button
            onClick={() => setFullscreen(true)}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </button>
        </div>

        <div className="mt-1.5">{modeTabs}</div>
        <div className="mt-2">{viewerContent("max-h-[250px]")}</div>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="flex flex-1 flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              {modeTabs}
              <button
                onClick={() => setFullscreen(false)}
                className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {viewerContent("max-h-[80vh]")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
