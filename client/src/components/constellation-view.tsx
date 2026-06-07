import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  listArtifacts,
  getLedgerLineage,
  verifyLedgerEntry,
} from "@/lib/api";
import type { ArtifactRecord, LedgerEntryRecord } from "@shared/schema";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Network,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
interface ConstellationNode {
  id: string;
  title: string;
  artifactType: string;
  status: string;
  entries: EntryNode[];
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface ConstellationEdge {
  source: string;
  target: string;
  type: "lineage" | "derives";
}

interface EntryNode {
  id: string;
  eventType: string;
  hash: string;
  prevHash: string | null;
  valid: boolean | null;
  computedHash: string | null;
  timestamp: string;
}

interface ConstellationViewProps {
  onBack: () => void;
}

// ── Colors ──────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  spec: "#8b5cf6",
  journal: "#3b82f6",
  sop: "#10b981",
  checklist: "#f59e0b",
  playbook: "#f43f5e",
  template: "#06b6d4",
  workflow: "#f97316",
  note: "#64748b",
  principles: "#eab308",
  other: "#6b7280",
};

const THEME = {
  bg: "#08080f",
  surface: "#111119",
  surfaceHover: "#1a1a25",
  border: "#2a2a3a",
  text: "#e8e8f0",
  textSec: "#8888a0",
  textDim: "#555568",
  violet: "#8b5cf6",
  green: "#22c55e",
  red: "#ef4444",
  ember: "#f59e0b",
};

// ── Cluster force ───────────────────────────────────────────────────
function applyClusterForce(
  nodes: ConstellationNode[],
  w: number,
  h: number,
  alpha: number
) {
  const types = [...new Set(nodes.map((n) => n.artifactType))];
  const angle = (i: number) => (i / types.length) * 2 * Math.PI - Math.PI / 2;
  const radius = Math.min(w, h) * 0.22;
  const centers: Record<string, { x: number; y: number }> = {};
  types.forEach((t, i) => {
    centers[t] = {
      x: w / 2 + Math.cos(angle(i)) * radius,
      y: h / 2 + Math.sin(angle(i)) * radius,
    };
  });
  nodes.forEach((n) => {
    const c = centers[n.artifactType];
    if (c) {
      n.vx += (c.x - n.x) * alpha * 0.08;
      n.vy += (c.y - n.y) * alpha * 0.08;
    }
  });
}

// ── Component ───────────────────────────────────────────────────────
export function ConstellationView({ onBack }: ConstellationViewProps) {
  const [nodes, setNodes] = useState<ConstellationNode[]>([]);
  const [edges, setEdges] = useState<ConstellationEdge[]>([]);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selected, setSelected] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<ConstellationNode, undefined> | null>(
    null
  );

  // ── Resize observer ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDims({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { artifacts } = await listArtifacts(100);
      const constellationNodes: ConstellationNode[] = artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        artifactType: a.type || "other",
        status: a.status,
        entries: [],
        x: dims.w / 2 + (Math.random() - 0.5) * 300,
        y: dims.h / 2 + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
      }));

      const constellationEdges: ConstellationEdge[] = [];
      const seenEdges = new Set<string>();
      const artifactIds = new Set(constellationNodes.map((n) => n.id));

      for (const node of constellationNodes) {
        try {
          const { entries } = await getLedgerLineage(node.id);
          node.entries = entries.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            hash: e.hash,
            prevHash: e.prevHash || null,
            valid: null,
            computedHash: null,
            timestamp: e.createdAt
              ? new Date(e.createdAt).toISOString()
              : "",
          }));

          // Build cross-artifact edges from parentArtifactId
          entries.forEach((e) => {
            const pid =
              (e as any).parentArtifactId || (e as any).parent_artifact_id;
            if (pid && pid !== node.id && artifactIds.has(pid)) {
              const key = `${pid}-${node.id}`;
              if (!seenEdges.has(key)) {
                seenEdges.add(key);
                constellationEdges.push({
                  source: pid,
                  target: node.id,
                  type: "lineage",
                });
              }
            }
          });
        } catch {
          // Lineage fetch may fail for some artifacts — continue
        }
      }

      setNodes(constellationNodes);
      setEdges(constellationEdges);
    } catch (e: any) {
      setError(e.message || "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }

  // ── D3 force simulation ───────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    if (simRef.current) simRef.current.stop();

    const simNodes = nodes.map((n) => ({ ...n }));
    const simEdges = edges.map((e) => ({ ...e }));
    const { w, h } = dims;

    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<ConstellationNode, ConstellationEdge>(simEdges)
          .id((d) => d.id)
          .distance(130)
          .strength(0.3)
      )
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collision", d3.forceCollide().radius(40))
      .force("cluster", (alpha: number) =>
        applyClusterForce(simNodes, w, h, alpha)
      )
      .alphaDecay(0.02)
      .on("tick", () => {
        const p: Record<string, { x: number; y: number }> = {};
        simNodes.forEach((n) => {
          n.x = Math.max(35, Math.min(w - 35, n.x));
          n.y = Math.max(35, Math.min(h - 35, n.y));
          p[n.id] = { x: n.x, y: n.y };
        });
        setPositions({ ...p });
      });

    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [nodes, edges, dims]);

  // ── Click-to-verify ───────────────────────────────────────────────
  const handleVerifyEntry = useCallback(
    async (entryId: string, artifactId: string) => {
      setVerifyingId(entryId);
      try {
        const result = await verifyLedgerEntry(entryId);
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== artifactId) return n;
            return {
              ...n,
              entries: n.entries.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      valid: result.valid,
                      computedHash: result.computedHash,
                    }
                  : e
              ),
            };
          })
        );
      } catch {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== artifactId) return n;
            return {
              ...n,
              entries: n.entries.map((e) =>
                e.id === entryId ? { ...e, valid: false } : e
              ),
            };
          })
        );
      } finally {
        setVerifyingId(null);
      }
    },
    []
  );

  const handleVerifyAll = useCallback(
    async (artifactId: string) => {
      const node = nodes.find((n) => n.id === artifactId);
      if (!node) return;
      for (const entry of node.entries) {
        await handleVerifyEntry(entry.id, artifactId);
      }
    },
    [nodes, handleVerifyEntry]
  );

  // ── Derived state ─────────────────────────────────────────────────
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selected) || null,
    [nodes, selected]
  );
  const selectedEntries = selectedNode?.entries || [];
  const allVerified =
    selectedEntries.length > 0 && selectedEntries.every((e) => e.valid === true);
  const anyFailed = selectedEntries.some((e) => e.valid === false);
  const typeList = useMemo(
    () => [...new Set(nodes.map((n) => n.artifactType))].sort(),
    [nodes]
  );

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: THEME.bg }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{ color: THEME.violet }}
          />
          <span style={{ color: THEME.textSec, fontFamily: "monospace" }}>
            Loading constellation…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: THEME.bg }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-8 w-8" style={{ color: THEME.red }} />
          <span style={{ color: THEME.textSec }}>{error}</span>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: THEME.bg,
        color: THEME.text,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface }}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" style={{ color: THEME.textSec }} />
          </Button>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: THEME.violet,
              boxShadow: `0 0 8px ${THEME.violet}66`,
            }}
          />
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: THEME.text }}
          >
            POW Ledger
          </span>
          <span
            className="text-xs tracking-wider"
            style={{ color: THEME.textDim }}
          >
            Constellation
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: THEME.textDim }}>
            {nodes.length} artifacts · {edges.length} links
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="hover:bg-white/5 text-xs"
            style={{ color: THEME.textSec }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Graph Canvas */}
        <div ref={containerRef} className="flex-1 relative">
          <svg width={dims.w} height={dims.h} className="block">
            <defs>
              <filter id="node-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <radialGradient
                  key={type}
                  id={`grad-${type}`}
                  cx="30%"
                  cy="30%"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.35} />
                </radialGradient>
              ))}
            </defs>

            {/* Grid */}
            <g opacity={0.05}>
              {Array.from({ length: Math.ceil(dims.w / 60) }, (_, i) => (
                <line
                  key={`gv${i}`}
                  x1={i * 60} y1={0} x2={i * 60} y2={dims.h}
                  stroke={THEME.textDim} strokeWidth={0.5}
                />
              ))}
              {Array.from({ length: Math.ceil(dims.h / 60) }, (_, i) => (
                <line
                  key={`gh${i}`}
                  x1={0} y1={i * 60} x2={dims.w} y2={i * 60}
                  stroke={THEME.textDim} strokeWidth={0.5}
                />
              ))}
            </g>

            {/* Edges */}
            {edges.map((e, i) => {
              const sId = typeof e.source === "string" ? e.source : (e.source as any)?.id;
              const tId = typeof e.target === "string" ? e.target : (e.target as any)?.id;
              const src = positions[sId];
              const tgt = positions[tId];
              if (!src || !tgt) return null;
              const isLineage = e.type === "lineage";
              return (
                <line
                  key={i}
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={isLineage ? THEME.ember : THEME.textDim}
                  strokeWidth={isLineage ? 1.5 : 0.8}
                  strokeDasharray={isLineage ? "6 4" : "none"}
                  opacity={isLineage ? 0.6 : 0.2}
                >
                  {isLineage && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="20" to="0" dur="2s"
                      repeatCount="indefinite"
                    />
                  )}
                </line>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;
              const color = TYPE_COLORS[node.artifactType] || TYPE_COLORS.other;
              const isSelected = selected === node.id;
              const r = 14 + Math.min(node.entries.length, 8) * 2;
              const verified =
                node.entries.length > 0 &&
                node.entries.every((e) => e.valid === true);
              const failed = node.entries.some((e) => e.valid === false);

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  onClick={() => setSelected(isSelected ? null : node.id)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      r={r + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      opacity={0.4}
                    >
                      <animate
                        attributeName="r"
                        values={`${r + 6};${r + 12};${r + 6}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.4;0.15;0.4"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  {/* Verification ring */}
                  {verified && (
                    <circle
                      r={r + 4}
                      fill="none"
                      stroke={THEME.green}
                      strokeWidth={2}
                      opacity={0.6}
                    />
                  )}
                  {failed && (
                    <circle
                      r={r + 4}
                      fill="none"
                      stroke={THEME.red}
                      strokeWidth={2}
                      opacity={0.6}
                    />
                  )}
                  {/* Main node */}
                  <circle
                    r={r}
                    fill={`url(#grad-${node.artifactType})`}
                    stroke={isSelected ? color : "transparent"}
                    strokeWidth={isSelected ? 2 : 0}
                    filter="url(#node-glow)"
                  />
                  <circle r={3} fill="#fff" opacity={0.6} />
                  {/* Label */}
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill={THEME.textSec}
                    fontFamily="inherit"
                  >
                    {node.title.length > 24
                      ? node.title.slice(0, 22) + "…"
                      : node.title}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div
            className="absolute bottom-3 left-3 rounded-md px-3 py-2"
            style={{
              background: `${THEME.surface}dd`,
              border: `1px solid ${THEME.border}`,
              fontSize: 10,
            }}
          >
            <div
              className="mb-1 uppercase tracking-widest"
              style={{ fontSize: 8, color: THEME.textDim }}
            >
              Artifact Types
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {typeList.map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: TYPE_COLORS[t] || TYPE_COLORS.other }}
                  />
                  <span style={{ color: THEME.textSec }}>{t}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 16,
                    borderTop: `1.5px dashed ${THEME.ember}`,
                  }}
                />
                <span style={{ color: THEME.textSec }}>hash chain</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 16,
                    borderTop: `1px solid ${THEME.textDim}`,
                  }}
                />
                <span style={{ color: THEME.textSec }}>derives</span>
              </div>
            </div>
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network
                  className="h-12 w-12 mx-auto mb-3"
                  style={{ color: THEME.textDim }}
                />
                <p style={{ color: THEME.textSec }}>No artifacts yet</p>
                <p className="text-xs mt-1" style={{ color: THEME.textDim }}>
                  Create some decisions to see the constellation
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div
          className="overflow-hidden transition-all duration-300 shrink-0"
          style={{
            width: selected ? 320 : 0,
            borderLeft: selected ? `1px solid ${THEME.border}` : "none",
            background: THEME.surface,
          }}
        >
          {selected && selectedNode && (
            <ScrollArea className="h-full">
              <div className="w-80 p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div
                      className="text-[8px] uppercase tracking-widest mb-1"
                      style={{
                        color:
                          TYPE_COLORS[selectedNode.artifactType] ||
                          TYPE_COLORS.other,
                      }}
                    >
                      {selectedNode.artifactType}
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                      {selectedNode.title}
                    </div>
                    <div
                      className="text-[10px] mt-1 font-mono"
                      style={{ color: THEME.textDim }}
                    >
                      {selectedNode.id}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1"
                    style={{ color: THEME.textDim, background: "none", border: "none", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                {/* Status badge */}
                {allVerified && (
                  <div
                    className="flex items-center gap-2 rounded-md px-3 py-2 mb-4"
                    style={{
                      background: `${THEME.green}12`,
                      border: `1px solid ${THEME.green}40`,
                    }}
                  >
                    <ShieldCheck className="h-4 w-4" style={{ color: THEME.green }} />
                    <div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: THEME.green }}
                      >
                        INTEGRITY VERIFIED
                      </div>
                      <div className="text-[9px]" style={{ color: THEME.textDim }}>
                        All {selectedEntries.length} entries valid
                      </div>
                    </div>
                  </div>
                )}
                {anyFailed && (
                  <div
                    className="flex items-center gap-2 rounded-md px-3 py-2 mb-4"
                    style={{
                      background: `${THEME.red}12`,
                      border: `1px solid ${THEME.red}40`,
                    }}
                  >
                    <ShieldAlert className="h-4 w-4" style={{ color: THEME.red }} />
                    <div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: THEME.red }}
                      >
                        INTEGRITY FAILURE
                      </div>
                      <div className="text-[9px]" style={{ color: THEME.textDim }}>
                        Tampered entries detected
                      </div>
                    </div>
                  </div>
                )}

                {/* Verify all button */}
                <button
                  onClick={() => handleVerifyAll(selected)}
                  disabled={!!verifyingId}
                  className="w-full py-2 mb-4 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    background: allVerified
                      ? `${THEME.green}18`
                      : `${THEME.violet}18`,
                    border: `1px solid ${allVerified ? THEME.green : THEME.violet}50`,
                    color: allVerified ? THEME.green : THEME.violet,
                    cursor: verifyingId ? "wait" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {verifyingId ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verifying…
                    </span>
                  ) : allVerified ? (
                    <span className="flex items-center justify-center gap-2">
                      <ShieldCheck className="h-3 w-3" />
                      All Verified
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Shield className="h-3 w-3" />
                      Verify All ({selectedEntries.length} entries)
                    </span>
                  )}
                </button>

                {/* Decision Chain */}
                <div
                  className="text-[8px] uppercase tracking-widest mb-2"
                  style={{ color: THEME.textDim }}
                >
                  Decision Chain
                </div>

                {selectedEntries.length === 0 && (
                  <div
                    className="text-xs text-center py-4"
                    style={{ color: THEME.textDim }}
                  >
                    No ledger entries found
                  </div>
                )}

                <div className="flex flex-col">
                  {selectedEntries.map((entry, i) => (
                    <div key={entry.id}>
                      <div
                        onClick={() =>
                          !verifyingId &&
                          handleVerifyEntry(entry.id, selected)
                        }
                        className="rounded-md px-3 py-2 transition-all"
                        style={{
                          background:
                            verifyingId === entry.id
                              ? `${THEME.violet}10`
                              : THEME.surfaceHover,
                          border: `1px solid ${
                            entry.valid === true
                              ? `${THEME.green}40`
                              : entry.valid === false
                              ? `${THEME.red}40`
                              : THEME.border
                          }`,
                          cursor: verifyingId ? "wait" : "pointer",
                        }}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span
                            className="text-[10px]"
                            style={{ color: THEME.textSec }}
                          >
                            {entry.eventType}
                          </span>
                          <span>
                            {verifyingId === entry.id ? (
                              <Loader2
                                className="h-3 w-3 animate-spin"
                                style={{ color: THEME.violet }}
                              />
                            ) : entry.valid === true ? (
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                style={{ color: THEME.green }}
                              />
                            ) : entry.valid === false ? (
                              <XCircle
                                className="h-3.5 w-3.5"
                                style={{ color: THEME.red }}
                              />
                            ) : (
                              <Circle
                                className="h-3.5 w-3.5"
                                style={{ color: THEME.textDim }}
                              />
                            )}
                          </span>
                        </div>
                        <div
                          className="text-[9px] font-mono truncate"
                          style={{ color: THEME.textDim }}
                        >
                          {entry.hash}
                        </div>
                        {entry.computedHash && entry.valid === true && (
                          <div
                            className="text-[8px] font-mono mt-0.5"
                            style={{ color: `${THEME.green}80` }}
                          >
                            ✓ matches {entry.computedHash.slice(0, 20)}…
                          </div>
                        )}
                        {entry.prevHash && (
                          <div
                            className="text-[8px] font-mono mt-0.5 opacity-40"
                            style={{ color: THEME.textDim }}
                          >
                            ← {entry.prevHash.slice(0, 24)}…
                          </div>
                        )}
                      </div>
                      {/* Chain connector */}
                      {i < selectedEntries.length - 1 && (
                        <div className="flex justify-center h-4">
                          <div
                            style={{
                              width: 1,
                              height: "100%",
                              borderLeft: `1px dashed ${THEME.ember}40`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Font import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
      `}</style>
    </div>
  );
}
