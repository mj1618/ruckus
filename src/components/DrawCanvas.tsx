"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";

const COLORS = [
  "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#06b6d4", "#000000",
];

const WIDTHS = [
  { label: "S", value: 2 },
  { label: "M", value: 5 },
  { label: "L", value: 10 },
];

interface DrawCanvasProps {
  channelId: Id<"channels">;
}

export function DrawCanvas({ channelId }: DrawCanvasProps) {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState("#ffffff");
  const [width, setWidth] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const canvasSize = useRef({ width: 0, height: 0 });

  const strokes = useQuery(api.drawing.getStrokes, { channelId });
  const addStroke = useMutation(api.drawing.addStroke);
  const clearCanvas = useMutation(api.drawing.clearCanvas);

  // Resize canvas to fill container
  useEffect(() => {
    function resize() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvasSize.current = { width: rect.width, height: rect.height };
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Redraw all strokes when data changes or canvas resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * canvas.width, stroke.points[i].y * canvas.height);
      }
      ctx.stroke();
    }
  }, [strokes]);

  function getPoint(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function drawLocalSegment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = isEraser ? "#09090b" : color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
    ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
    ctx.stroke();
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const pt = getPoint(e);
    currentPoints.current = [pt];
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing) return;
    const pt = getPoint(e);
    const points = currentPoints.current;
    if (points.length > 0) {
      drawLocalSegment(points[points.length - 1], pt);
    }
    points.push(pt);
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const points = currentPoints.current;
    if (points.length >= 2 && user) {
      addStroke({
        channelId,
        userId: user._id,
        points,
        color: isEraser ? "#09090b" : color,
        width,
      });
    }
    currentPoints.current = [];
  }

  function handleClear() {
    clearCanvas({ channelId });
    setShowClearConfirm(false);
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 cursor-crosshair" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 bg-zinc-950"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-4 py-2">
        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setIsEraser(false); }}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                color === c && !isEraser ? "scale-125 border-white" : "border-zinc-600"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <div className="h-6 w-px bg-zinc-700" />

        {/* Brush widths */}
        <div className="flex items-center gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWidth(w.value)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                width === w.value
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-zinc-700" />

        {/* Eraser */}
        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`rounded px-2 py-1 text-xs font-medium ${
            isEraser
              ? "bg-indigo-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-white"
          }`}
        >
          Eraser
        </button>

        <div className="flex-1" />

        {/* Clear */}
        {showClearConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Clear all?</span>
            <button
              onClick={handleClear}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
