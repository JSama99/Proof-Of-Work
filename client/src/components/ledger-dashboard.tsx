import { useState, useEffect, useCallback } from "react";
import { listLedgerEntries, verifyLedgerEntry, getLedgerLineage, type ListLedgerFilters } from "@/lib/api";
import type { LedgerEntryRecord } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ScrollText,
  CheckCircle2,
  XCircle,
  ArrowDown,
  Loader2,
  ChevronLeft,
  GitBranch,
  Hash,
  User,
  Clock,
  Terminal,
  FileType,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TERMINAL_COLORS: Record<string, string> = {
  POW: "bg-primary/10 text-primary border-primary/20",
  TalonVision: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "Da Cypher": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "Sonic Genesis": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  TalonFly: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Decipher: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  SignGenesis: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

const EVENT_LABELS: Record<string, string> = {
  artifact_created: "Created",
  artifact_revised: "Revised",
  artifact_approved: "Approved",
  prompt_used: "Prompt Used",
  model_version_recorded: "Model Recorded",
  collaborator_contribution: "Contribution",
  ownership_transfer: "Ownership Transfer",
  export_published: "Published",
  deliverable_completed: "Deliverable Done",
  decision_checkpoint: "Decision",
  scope_change_acknowledged: "Scope Change",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

interface LedgerDashboardProps {
  onBack: () => void;
}

export function LedgerDashboard({ onBack }: LedgerDashboardProps) {
  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filters, setFilters] = useState<ListLedgerFilters>({});
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntryRecord | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ computedHash: string; valid: boolean } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lineageEntries, setLineageEntries] = useState<LedgerEntryRecord[]>([]);
  const [showLineage, setShowLineage] = useState(false);
  const [lineageArtifactId, setLineageArtifactId] = useState<string | null>(null);

  const loadEntries = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const cursor = reset ? null : nextCursor;
      const result = await listLedgerEntries(50, cursor, filters);
      if (reset) {
        setEntries(result.entries);
      } else {
        setEntries((prev) => [...prev, ...result.entries]);
      }
      setNextCursor(result.nextCursor);
    } catch (e) {
      console.error("Failed to load ledger entries:", e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filters, nextCursor]);

  useEffect(() => {
    loadEntries(true);
  }, [filters]);

  const handleVerify = async (entryId: string) => {
    setIsVerifying(true);
    try {
      const result = await verifyLedgerEntry(entryId);
      setVerificationResult({ computedHash: result.computedHash, valid: result.valid });
    } catch (e) {
      console.error("Verification failed:", e);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleShowLineage = async (artifactId: string) => {
    setLineageArtifactId(artifactId);
    setShowLineage(true);
    try {
      const result = await getLedgerLineage(artifactId);
      setLineageEntries(result.entries);
    } catch (e) {
      console.error("Failed to load lineage:", e);
    }
  };

  const handleFilterChange = (key: keyof ListLedgerFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === "all" || value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full" data-testid="ledger-dashboard">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-ledger-back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
            <ScrollText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold">POW Ledger</h1>
        </div>
        <Badge variant="outline" className="ml-auto text-xs" data-testid="text-ledger-count">
          {entries.length} entries
        </Badge>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <Select
          value={filters.terminalSource || "all"}
          onValueChange={(v) => handleFilterChange("terminalSource", v)}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-terminal-filter">
            <SelectValue placeholder="Terminal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Terminals</SelectItem>
            <SelectItem value="POW">POW</SelectItem>
            <SelectItem value="TalonVision">TalonVision</SelectItem>
            <SelectItem value="Da Cypher">Da Cypher</SelectItem>
            <SelectItem value="Sonic Genesis">Sonic Genesis</SelectItem>
            <SelectItem value="TalonFly">TalonFly</SelectItem>
            <SelectItem value="Decipher">Decipher</SelectItem>
            <SelectItem value="SignGenesis">SignGenesis</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.eventType || "all"}
          onValueChange={(v) => handleFilterChange("eventType", v)}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-event-filter">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="artifact_created">Created</SelectItem>
            <SelectItem value="artifact_revised">Revised</SelectItem>
            <SelectItem value="artifact_approved">Approved</SelectItem>
            <SelectItem value="decision_checkpoint">Decision</SelectItem>
            <SelectItem value="scope_change_acknowledged">Scope Change</SelectItem>
            <SelectItem value="export_published">Published</SelectItem>
            <SelectItem value="ownership_transfer">Ownership Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <ScrollText className="h-8 w-8" />
            <p className="text-sm">No ledger entries yet</p>
            <p className="text-xs">Actions in POW will automatically create proof records</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {entries.map((entry) => (
              <LedgerEntryCard
                key={entry.id}
                entry={entry}
                onSelect={() => {
                  setSelectedEntry(entry);
                  setVerificationResult(null);
                }}
                onShowLineage={entry.artifactId ? () => handleShowLineage(entry.artifactId!) : undefined}
              />
            ))}

            {nextCursor && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadEntries(false)}
                  disabled={isLoadingMore}
                  data-testid="button-load-more-ledger"
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowDown className="h-4 w-4 mr-2" />
                  )}
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-ledger-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Ledger Entry Detail
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Terminal className="h-3 w-3" /> Terminal
                  </span>
                  <Badge variant="outline" className={cn("mt-1", TERMINAL_COLORS[selectedEntry.terminalSource] || "")}>
                    {selectedEntry.terminalSource}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <FileType className="h-3 w-3" /> Event
                  </span>
                  <p className="font-medium mt-1">{EVENT_LABELS[selectedEntry.eventType] || selectedEntry.eventType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Actor
                  </span>
                  <p className="font-medium mt-1">{selectedEntry.actorId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Timestamp
                  </span>
                  <p className="font-medium mt-1">{new Date(selectedEntry.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedEntry.artifactId && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Artifact ID</span>
                  <p className="font-mono text-xs mt-1 bg-muted/50 px-2 py-1 rounded">{selectedEntry.artifactId}</p>
                </div>
              )}

              {selectedEntry.artifactType && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Artifact Type</span>
                  <p className="font-medium mt-1">{selectedEntry.artifactType}</p>
                </div>
              )}

              {selectedEntry.artifactHash && (
                <div className="text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Artifact Hash
                  </span>
                  <p className="font-mono text-xs mt-1 bg-muted/50 px-2 py-1 rounded break-all">{selectedEntry.artifactHash}</p>
                </div>
              )}

              {selectedEntry.signature && (
                <div className="text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Entry Signature
                  </span>
                  <p className="font-mono text-xs mt-1 bg-muted/50 px-2 py-1 rounded break-all">{selectedEntry.signature}</p>
                </div>
              )}

              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Metadata</span>
                  <pre className="font-mono text-xs mt-1 bg-muted/50 px-2 py-1 rounded overflow-x-auto">
                    {JSON.stringify(selectedEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerify(selectedEntry.id)}
                  disabled={isVerifying}
                  data-testid="button-verify-entry"
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  Verify Integrity
                </Button>

                {selectedEntry.artifactId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedEntry(null);
                      handleShowLineage(selectedEntry.artifactId!);
                    }}
                    data-testid="button-view-lineage"
                  >
                    <GitBranch className="h-4 w-4 mr-2" />
                    View Lineage
                  </Button>
                )}
              </div>

              {verificationResult && (
                <Card className={cn(
                  "border",
                  verificationResult.valid
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
                )}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {verificationResult.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <div className="text-sm">
                      <p className="font-medium">
                        {verificationResult.valid ? "Integrity Verified" : "Integrity Mismatch"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                        Hash: {truncateHash(verificationResult.computedHash)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showLineage} onOpenChange={(open) => !open && setShowLineage(false)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-lineage">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Artifact Lineage
            </DialogTitle>
          </DialogHeader>
          {lineageEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No lineage entries found</p>
          ) : (
            <div className="relative pl-6 space-y-0">
              {lineageEntries.map((entry, index) => (
                <div key={entry.id} className="relative pb-4">
                  {index < lineageEntries.length - 1 && (
                    <div className="absolute left-[-16px] top-6 bottom-0 w-px bg-border" />
                  )}
                  <div className="absolute left-[-20px] top-2 w-2 h-2 rounded-full bg-primary border-2 border-background" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", TERMINAL_COLORS[entry.terminalSource] || "")}>
                        {entry.terminalSource}
                      </Badge>
                      <span className="font-medium">{EVENT_LABELS[entry.eventType] || entry.eventType}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{entry.actorId}</span>
                      <span>{formatTimestamp(entry.createdAt)}</span>
                    </div>
                    {entry.artifactHash && (
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        {truncateHash(entry.artifactHash)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LedgerEntryCard({
  entry,
  onSelect,
  onShowLineage,
}: {
  entry: LedgerEntryRecord;
  onSelect: () => void;
  onShowLineage?: () => void;
}) {
  const terminalColorClass = TERMINAL_COLORS[entry.terminalSource] || "bg-muted text-muted-foreground";
  const metadata = entry.metadata as Record<string, unknown> | undefined;
  const title = metadata?.artifactTitle as string | undefined;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onSelect}
      data-testid={`card-ledger-entry-${entry.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-xs border", terminalColorClass)}>
                {entry.terminalSource}
              </Badge>
              <span className="text-sm font-medium">
                {EVENT_LABELS[entry.eventType] || entry.eventType}
              </span>
            </div>
            {title && (
              <p className="text-sm text-muted-foreground truncate">{title}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.actorId}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimestamp(entry.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {entry.signature && (
              <span className="font-mono text-xs text-muted-foreground" data-testid={`text-hash-${entry.id}`}>
                {entry.signature.slice(0, 8)}...
              </span>
            )}
            {onShowLineage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowLineage();
                }}
                data-testid={`button-lineage-${entry.id}`}
              >
                <GitBranch className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
