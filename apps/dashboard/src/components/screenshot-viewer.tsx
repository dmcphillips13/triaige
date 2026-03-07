// Screenshot comparison viewer with three modes: side-by-side, swipe slider,
// and diff overlay. Renders base64 PNG screenshots as data URIs.
//
// The swipe mode uses react-compare-slider for a draggable divider between
// baseline and actual. The diff mode shows the red-highlighted overlay from
// the Pillow image diff (Step 9). Vision summary text (from GPT-4o, Step 10)
// is displayed below the images when available.
//
// Props:
//   baseline    — base64-encoded PNG of the expected screenshot
//   actual      — base64-encoded PNG of the current screenshot
//   diffOverlay — base64-encoded PNG of the diff overlay (optional, from image_diff)
//   visionSummary — GPT-4o's qualitative analysis of the visual diff (optional)

"use client";

import { useState } from "react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { cn } from "@/lib/utils";

type Mode = "side-by-side" | "swipe" | "diff";

export function ScreenshotViewer({
  baseline,
  actual,
  diffOverlay,
  visionSummary,
}: {
  baseline: string;
  actual: string;
  diffOverlay?: string | null;
  visionSummary?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("side-by-side");

  const baselineSrc = `data:image/png;base64,${baseline}`;
  const actualSrc = `data:image/png;base64,${actual}`;
  const diffSrc = diffOverlay ? `data:image/png;base64,${diffOverlay}` : null;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Screenshots
      </h4>

      {/* Mode tabs */}
      <div className="mt-1.5 flex gap-1">
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

      {/* Viewer content */}
      <div className="mt-2 overflow-hidden rounded-md border border-zinc-200">
        {mode === "side-by-side" && (
          <div className="flex gap-px bg-zinc-200">
            <div className="flex-1 bg-white p-2">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Baseline
              </span>
              <img
                src={baselineSrc}
                alt="Baseline screenshot"
                className="max-h-[400px] w-full object-contain"
              />
            </div>
            <div className="flex-1 bg-white p-2">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Actual
              </span>
              <img
                src={actualSrc}
                alt="Actual screenshot"
                className="max-h-[400px] w-full object-contain"
              />
            </div>
          </div>
        )}

        {mode === "swipe" && (
          <ReactCompareSlider
            itemOne={
              <ReactCompareSliderImage
                src={baselineSrc}
                alt="Baseline screenshot"
              />
            }
            itemTwo={
              <ReactCompareSliderImage
                src={actualSrc}
                alt="Actual screenshot"
              />
            }
            className="max-h-[500px]"
          />
        )}

        {mode === "diff" && diffSrc && (
          <div className="bg-white p-2">
            <img
              src={diffSrc}
              alt="Diff overlay"
              className="max-h-[500px] w-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Vision summary */}
      {visionSummary && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Vision Analysis
          </h4>
          <p className="mt-1 text-sm text-zinc-700">{visionSummary}</p>
        </div>
      )}
    </div>
  );
}
