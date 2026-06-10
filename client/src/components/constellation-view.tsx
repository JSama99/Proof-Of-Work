import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface AnchorStar {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  count: number;
}

interface ConstellationViewProps {
  onBack: () => void;
}

// ── Palette ─────────────────────────────────────────────────────────
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
  bg: "#06060c",
  surface: "#0d0d16",
  surfaceHover: "#15152a",
  border: "#1e1e3a",
  text: "#e8e8f0",
  textSec: "#8888a0",
  textDim: "#444460",
  violet: "#8b5cf6",
  green: "#22c55e",
  red: "#ef4444",
  ember: "#f59e0b",
};

// ── Star field ──────────────────────────────────────────────────────
function generateStars(w: number, h: number, count = 200) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      o: Math.random() * 0.5 + 0.1,
    });
  }
  return stars;
}

// ── Anchor positions ────────────────────────────────────────────────
function computeAnchors(
  types: string[],
  w: number,
  h: number,
  typeCounts: Record<string, number>
): AnchorStar[] {
  const radius = Math.min(w, h) * 0.28;
  return types.map((t, i) => {
    const angle = (i / types.length) * 2 * Math.PI - Math.PI / 2;
    return {
      id: `anchor-${t}`,
      label: t,
      color: TYPE_COLORS[t] || TYPE_COLORS.other,
      x: w / 2 + Math.cos(angle) * radius,
      y: h / 2 + Math.sin(angle) * radius,
      count: typeCounts[t] || 0,
    };
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
  const [hovered, setHovered] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 650 });
  const [anchors, setAnchors] = useState<AnchorStar[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<ConstellationNode, undefined> | null>(null);

  const stars = useMemo(() => generateStars(dims.w, dims.h, 180), [dims]);

  // ── Resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

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

      // Load lineage + build edges
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
            timestamp: e.createdAt ? new Date(e.createdAt).toISOString() : "",
          }));
          entries.forEach((e) => {
            const pid = (e as any).parentArtifactId || (e as any).parent_artifact_id;
            if (pid && pid !== node.id && artifactIds.has(pid)) {
              const key = `${pid}-${node.id}`;
              if (!seenEdges.has(key)) {
                seenEdges.add(key);
                constellationEdges.push({ source: pid, target: node.id, type: "lineage" });
              }
            }
          });
        } catch { /* continue */ }
      }

      setNodes(constellationNodes);
      setEdges(constellationEdges);

      // Auto-verify all entries
      for (const node of constellationNodes) {
        for (const entry of node.entries) {
          try {
            const result = await verifyLedgerEntry(entry.id);
            entry.valid = result.valid;
            entry.computedHash = result.computedHash;
          } catch {
            entry.valid = false;
          }
        }
      }
      setNodes([...constellationNodes]);
    } catch (e: any) {
      setError(e.message || "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }

  // ── Compute anchors ───────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    const types = [...new Set(nodes.map((n) => n.artifactType))].sort();
    const counts: Record<string, number> = {};
    nodes.forEach((n) => { counts[n.artifactType] = (counts[n.artifactType] || 0) + 1; });
    setAnchors(computeAnchors(types, dims.w, dims.h, counts));
  }, [nodes, dims]);

  // ── D3 simulation ─────────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0 || anchors.length === 0) return;
    if (simRef.current) simRef.current.stop();

    const simNodes = nodes.map((n) => ({ ...n }));
    const simEdges = edges.map((e) => ({ ...e }));
    const { w, h } = dims;

    // Build anchor lookup
    const anchorMap: Record<string, { x: number; y: number }> = {};
    anchors.forEach((a) => { anchorMap[a.label] = { x: a.x, y: a.y }; });
    const MAX_ORBIT = 120;

    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3.forceLink<ConstellationNode, ConstellationEdge>(simEdges)
          .id((d) => d.id).distance(100).strength(0.2)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("collision", d3.forceCollide().radius(28))
      .force("orbit", (alpha: number) => {
        simNodes.forEach((n) => {
          const center = anchorMap[n.artifactType];
          if (!center) return;
          const dx = n.x - center.x;
          const dy = n.y - center.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Pull toward anchor
          n.vx += (center.x - n.x) * alpha * 0.06;
          n.vy += (center.y - n.y) * alpha * 0.06;
          // Keep within orbit
          if (dist > MAX_ORBIT) {
            const ratio = MAX_ORBIT / dist;
            n.x = center.x + dx * ratio;
            n.y = center.y + dy * ratio;
          }
        });
      })
      .alphaDecay(0.025)
      .on("tick", () => {
        const p: Record<string, { x: number; y: number }> = {};
        simNodes.forEach((n) => {
          n.x = Math.max(30, Math.min(w - 30, n.x));
          n.y = Math.max(30, Math.min(h - 30, n.y));
          p[n.id] = { x: n.x, y: n.y };
        });
        setPositions({ ...p });
      });

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [nodes, edges, dims, anchors]);

  // ── Verify entry ──────────────────────────────────────────────────
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
                  ? { ...e, valid: result.valid, computedHash: result.computedHash }
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
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selected) || null, [nodes, selected]);
  const selectedEntries = selectedNode?.entries || [];
  const allVerified = selectedEntries.length > 0 && selectedEntries.every((e) => e.valid === true);
  const anyFailed = selectedEntries.some((e) => e.valid === false);

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: THEME.bg }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full" style={{
              background: `radial-gradient(circle, ${THEME.violet}40 0%, transparent 70%)`,
              animation: "pulse 2s ease-in-out infinite",
            }} />
            <Loader2 className="h-6 w-6 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: THEME.violet }} />
          </div>
          <span style={{ color: THEME.textSec, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2 }}>
            MAPPING CONSTELLATION
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: THEME.bg }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-8 w-8" style={{ color: THEME.red }} />
          <span style={{ color: THEME.textSec }}>{error}</span>
          <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{
      background: THEME.bg,
      color: THEME.text,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{
        borderBottom: `1px solid ${THEME.border}`,
        background: `${THEME.surface}cc`,
        backdropFilter: "blur(8px)",
      }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" style={{ color: THEME.textSec }} />
          </Button>
          <div className="w-2 h-2 rounded-full" style={{
            background: THEME.violet,
            boxShadow: `0 0 12px ${THEME.violet}88, 0 0 4px ${THEME.violet}`,
          }} />
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: THEME.text }}>
            POW Constellation
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: THEME.textDim }}>
            {nodes.length} artifacts · {edges.length} links
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Graph Canvas */}
        <div ref={containerRef} className="flex-1 relative">
          <svg width={dims.w} height={dims.h} className="block">
            <defs>
              <filter id="glow-sm">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-lg">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-xl">
                <feGaussianBlur stdDeviation="12" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <radialGradient key={type} id={`grad-${type}`} cx="35%" cy="35%">
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="60%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                </radialGradient>
              ))}
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <radialGradient key={`star-${type}`} id={`star-grad-${type}`} cx="40%" cy="40%">
                  <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
                  <stop offset="20%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="60%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </radialGradient>
              ))}
            </defs>

            {/* Star field */}
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o}>
                {s.r > 1 && (
                  <animate attributeName="opacity" values={`${s.o};${s.o * 0.3};${s.o}`}
                    dur={`${3 + Math.random() * 4}s`} repeatCount="indefinite" />
                )}
              </circle>
            ))}

            {/* Anchor stars — type cluster centers */}
            {anchors.map((a) => (
              <g key={a.id} transform={`translate(${a.x},${a.y})`}>
                {/* Outer glow */}
                <circle r={40} fill={`url(#star-grad-${a.label})`} opacity={0.4} filter="url(#glow-xl)">
                  <animate attributeName="opacity" values="0.3;0.5;0.3" dur="4s" repeatCount="indefinite" />
                </circle>
                {/* Inner orb */}
                <circle r={8} fill={a.color} opacity={0.9} filter="url(#glow-lg)" />
                <circle r={3} fill="#fff" opacity={0.8} />
                {/* Label */}
                <text y={-18} textAnchor="middle" fontSize={9} fill={a.color}
                  fontFamily="inherit" letterSpacing="1.5" opacity={0.7}
                  style={{ textTransform: "uppercase" } as any}>
                  {a.label}
                </text>
                <text y={54} textAnchor="middle" fontSize={8} fill={THEME.textDim} fontFamily="inherit">
                  {a.count}
                </text>
              </g>
            ))}

            {/* Edges */}
            {edges.map((e, i) => {
              const sId = typeof e.source === "string" ? e.source : (e.source as any)?.id;
              const tId = typeof e.target === "string" ? e.target : (e.target as any)?.id;
              const src = positions[sId];
              const tgt = positions[tId];
              if (!src || !tgt) return null;
              return (
                <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={THEME.ember} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.35}>
                  <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.5s" repeatCount="indefinite" />
                </line>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;
              const color = TYPE_COLORS[node.artifactType] || TYPE_COLORS.other;
              const isSelected = selected === node.id;
              const isHovered = hovered === node.id;
              const r = 10 + Math.min(node.entries.length, 6) * 2;
              const verified = node.entries.length > 0 && node.entries.every((e) => e.valid === true);
              const failed = node.entries.some((e) => e.valid === false);
              const statusOpacity = node.status === "draft" ? 0.85 : node.status === "complete" ? 1 : 0.5;

              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={() => setSelected(isSelected ? null : node.id)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }} opacity={statusOpacity}>

                  {/* Selection pulse */}
                  {isSelected && (
                    <circle r={r + 10} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
                      <animate attributeName="r" values={`${r + 8};${r + 16};${r + 8}`} dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0.08;0.3" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Verification ring */}
                  {verified && (
                    <circle r={r + 4} fill="none" stroke={THEME.green} strokeWidth={1.5} opacity={0.6} filter="url(#glow-sm)">
                      <animate attributeName="opacity" values="0.6;0.3;0.6" dur="3s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {failed && (
                    <circle r={r + 4} fill="none" stroke={THEME.red} strokeWidth={1.5} opacity={0.7} />
                  )}

                  {/* Main body */}
                  <circle r={r} fill={`url(#grad-${node.artifactType})`}
                    stroke={isSelected || isHovered ? color : "transparent"}
                    strokeWidth={isSelected ? 1.5 : 1} filter="url(#glow-sm)" />

                  {/* Core light */}
                  <circle r={2} fill="#fff" opacity={0.7} />

                  {/* Label — show on hover or select */}
                  {(isHovered || isSelected) && (
                    <text y={r + 14} textAnchor="middle" fontSize={9}
                      fill={THEME.textSec} fontFamily="inherit">
                      {node.title.length > 28 ? node.title.slice(0, 26) + "…" : node.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 rounded-lg px-3 py-2" style={{
            background: `${THEME.surface}dd`,
            border: `1px solid ${THEME.border}`,
            backdropFilter: "blur(8px)",
            fontSize: 10,
          }}>
            <div className="mb-1.5 uppercase tracking-widest" style={{ fontSize: 8, color: THEME.textDim }}>
              Artifact Types
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {anchors.map((a) => (
                <div key={a.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{
                    background: a.color,
                    boxShadow: `0 0 4px ${a.color}66`,
                  }} />
                  <span style={{ color: THEME.textSec }}>{a.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 pt-1.5" style={{ borderTop: `1px solid ${THEME.border}` }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{
                  background: "transparent",
                  border: `1.5px solid ${THEME.green}`,
                }} />
                <span style={{ color: THEME.textDim }}>verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 14, borderTop: `1.5px dashed ${THEME.ember}` }} />
                <span style={{ color: THEME.textDim }}>hash chain</span>
              </div>
            </div>
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network className="h-12 w-12 mx-auto mb-3" style={{ color: THEME.textDim }} />
                <p style={{ color: THEME.textSec }}>No artifacts yet</p>
                <p className="text-xs mt-1" style={{ color: THEME.textDim }}>
                  Capture decisions through the Orchestrator
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="overflow-hidden transition-all duration-300 shrink-0" style={{
          width: selected ? 320 : 0,
          borderLeft: selected ? `1px solid ${THEME.border}` : "none",
          background: THEME.surface,
        }}>
          {selected && selectedNode && (
            <ScrollArea className="h-full">
              <div className="w-80 p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest mb-1" style={{
                      color: TYPE_COLORS[selectedNode.artifactType] || TYPE_COLORS.other,
                    }}>
                      {selectedNode.artifactType}
                    </div>
                    <div className="text-sm font-semibold leading-tight">{selectedNode.title}</div>
                    <div className="text-[10px] mt-1 font-mono" style={{ color: THEME.textDim }}>
                      {selectedNode.id}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="p-1" style={{ color: THEME.textDim, background: "none", border: "none", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>

                {/* Integrity status */}
                {allVerified && (
                  <div className="flex items-center gap-2 rounded-md px-3 py-2 mb-4" style={{
                    background: `${THEME.green}10`,
                    border: `1px solid ${THEME.green}30`,
                  }}>
                    <ShieldCheck className="h-4 w-4" style={{ color: THEME.green }} />
                    <div>
                      <div className="text-[11px] font-semibold" style={{ color: THEME.green }}>
                        INTEGRITY VERIFIED
                      </div>
                      <div className="text-[9px]" style={{ color: THEME.textDim }}>
                        All {selectedEntries.length} entries valid
                      </div>
                    </div>
                  </div>
                )}
                {anyFailed && (
                  <div className="flex items-center gap-2 rounded-md px-3 py-2 mb-4" style={{
                    background: `${THEME.red}10`,
                    border: `1px solid ${THEME.red}30`,
                  }}>
                    <ShieldAlert className="h-4 w-4" style={{ color: THEME.red }} />
                    <div>
                      <div className="text-[11px] font-semibold" style={{ color: THEME.red }}>
                        INTEGRITY FAILURE
                      </div>
                      <div className="text-[9px]" style={{ color: THEME.textDim }}>
                        Tampered entries detected
                      </div>
                    </div>
                  </div>
                )}

                {/* Verify button */}
                <button onClick={() => handleVerifyAll(selected)} disabled={!!verifyingId}
                  className="w-full py-2 mb-4 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    background: allVerified ? `${THEME.green}12` : `${THEME.violet}12`,
                    border: `1px solid ${allVerified ? THEME.green : THEME.violet}40`,
                    color: allVerified ? THEME.green : THEME.violet,
                    cursor: verifyingId ? "wait" : "pointer",
                    fontFamily: "inherit",
                  }}>
                  {verifyingId ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Verifying…
                    </span>
                  ) : allVerified ? (
                    <span className="flex items-center justify-center gap-2">
                      <ShieldCheck className="h-3 w-3" /> All Verified
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Shield className="h-3 w-3" /> Verify All ({selectedEntries.length})
                    </span>
                  )}
                </button>

                {/* Decision Chain */}
                <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: THEME.textDim }}>
                  Decision Chain
                </div>

                {selectedEntries.length === 0 && (
                  <div className="text-xs text-center py-4" style={{ color: THEME.textDim }}>
                    No ledger entries found
                  </div>
                )}

                <div className="flex flex-col">
                  {selectedEntries.map((entry, i) => (
                    <div key={entry.id}>
                      <div onClick={() => !verifyingId && handleVerifyEntry(entry.id, selected)}
                        className="rounded-md px-3 py-2 transition-all" style={{
                          background: verifyingId === entry.id ? `${THEME.violet}08` : THEME.surfaceHover,
                          border: `1px solid ${
                            entry.valid === true ? `${THEME.green}30`
                              : entry.valid === false ? `${THEME.red}30` : THEME.border
                          }`,
                          cursor: verifyingId ? "wait" : "pointer",
                        }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px]" style={{ color: THEME.textSec }}>
                            {entry.eventType}
                          </span>
                          {verifyingId === entry.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" style={{ color: THEME.violet }} />
                          ) : entry.valid === true ? (
                            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: THEME.green }} />
                          ) : entry.valid === false ? (
                            <XCircle className="h-3.5 w-3.5" style={{ color: THEME.red }} />
                          ) : (
                            <Circle className="h-3.5 w-3.5" style={{ color: THEME.textDim }} />
                          )}
                        </div>
                        <div className="text-[9px] font-mono truncate" style={{ color: THEME.textDim }}>
                          {entry.hash}
                        </div>
                        {entry.computedHash && entry.valid === true && (
                          <div className="text-[8px] font-mono mt-0.5" style={{ color: `${THEME.green}80` }}>
                            ✓ matches {entry.computedHash.slice(0, 20)}…
                          </div>
                        )}
                      </div>
                      {i < selectedEntries.length - 1 && (
                        <div className="flex justify-center h-4">
                          <div style={{ width: 1, height: "100%", borderLeft: `1px dashed ${THEME.ember}40` }} />
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 0.7; } }
      `}</style>
    </div>
  );
}
