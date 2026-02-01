import { useState, useEffect } from "react";
import { reviseArtifact, archiveArtifact, restoreArtifact, getSnapshot } from "@/lib/api";
import type { ArtifactRecord, ArtifactSnapshotRecord, RTVResponse, ArtifactStructure } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  Loader2, 
  RefreshCw,
  Tag,
  Lock,
  Users,
  ListChecks,
  Download,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Shield,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { RTVStatus } from "./complete-artifact";

const STRUCTURE_LABELS: Record<keyof ArtifactStructure, string> = {
  audience: "Audience",
  includesWhy: "Includes Why",
  reusable: "Reusable",
  hasStepsOrProcess: "Has Steps/Process",
  coordinatesToolsOrAgents: "Coordinates Tools/Agents",
  expressesValues: "Expresses Values",
  thinkingOnly: "Thinking Only",
};

function DriftVisualization({ 
  current, 
  parent 
}: { 
  current: ArtifactStructure; 
  parent: ArtifactStructure;
}) {
  const changes: { key: keyof ArtifactStructure; from: string | boolean; to: string | boolean }[] = [];
  
  for (const key of Object.keys(current) as (keyof ArtifactStructure)[]) {
    if (current[key] !== parent[key]) {
      changes.push({ key, from: parent[key], to: current[key] });
    }
  }
  
  if (changes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No structural changes from parent revision
      </div>
    );
  }
  
  return (
    <div className="space-y-2" data-testid="drift-visualization">
      <div className="text-sm text-muted-foreground mb-2">
        {changes.length} structural {changes.length === 1 ? "change" : "changes"} from parent:
      </div>
      {changes.map(({ key, from, to }) => (
        <div key={key} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-2 flex-wrap">
          <span className="font-medium min-w-32">{STRUCTURE_LABELS[key]}:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">was</span>
            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
              {typeof from === "boolean" ? (from ? "Yes" : "No") : from}
            </Badge>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">now</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              {typeof to === "boolean" ? (to ? "Yes" : "No") : to}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SnapshotViewProps {
  artifact: ArtifactRecord;
  snapshot: ArtifactSnapshotRecord | null;
  rtv: RTVResponse | null;
  onRevise: (newArtifact: ArtifactRecord) => void;
  onArchiveChange?: () => void;
}

export function SnapshotView({ artifact, snapshot, rtv, onRevise, onArchiveChange }: SnapshotViewProps) {
  const [isReviseDialogOpen, setIsReviseDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [parentSnapshot, setParentSnapshot] = useState<ArtifactSnapshotRecord | null>(null);
  const [isLoadingParent, setIsLoadingParent] = useState(false);

  useEffect(() => {
    async function fetchParentSnapshot() {
      if (artifact.parentArtifactId && artifact.parentSnapshotId) {
        setIsLoadingParent(true);
        try {
          const result = await getSnapshot(artifact.parentArtifactId, artifact.parentSnapshotId);
          setParentSnapshot(result.snapshot);
        } catch (e) {
          console.error("Failed to fetch parent snapshot:", e);
        } finally {
          setIsLoadingParent(false);
        }
      } else {
        setParentSnapshot(null);
      }
    }
    fetchParentSnapshot();
  }, [artifact.parentArtifactId, artifact.parentSnapshotId]);

  async function handleRevise() {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await reviseArtifact(artifact.id, { 
        title: newTitle.trim() || undefined 
      });
      setNewTitle("");
      setIsReviseDialogOpen(false);
      onRevise(result.artifact);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    setIsArchiving(true);
    try {
      await archiveArtifact(artifact.id);
      onArchiveChange?.();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestore() {
    setIsArchiving(true);
    try {
      await restoreArtifact(artifact.id);
      onArchiveChange?.();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsArchiving(false);
    }
  }

  function handleExport() {
    const displayBody = snapshot?.body ?? artifact.body ?? "";
    const displayFinishSummary = snapshot?.finishSummary ?? artifact.finishSummary;
    
    const markdown = `# ${artifact.title}

**Type:** ${artifact.type}
**Status:** ${artifact.status}${artifact.isScopeExpansion ? `
**Scope:** Expansion (outside original cycle goal)` : ""}
${artifact.completedAt ? `**Completed:** ${format(new Date(artifact.completedAt), "MMMM d, yyyy 'at' h:mm a")}` : ""}

---

${displayFinishSummary ? `## Finish Summary\n\n${displayFinishSummary}\n\n---\n\n` : ""}## Content

${displayBody}
`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleBlackBoxExport() {
    const displayBody = snapshot?.body ?? artifact.body ?? "";
    const displayFinishSummary = snapshot?.finishSummary ?? artifact.finishSummary;
    const displayFinishCriteria = snapshot?.finishCriteria ?? artifact.finishCriteria;
    const displayStructure = snapshot?.structure ?? artifact.structure;
    
    const sealedDocument = {
      _format: "POW_BLACK_BOX_v1",
      _exportedAt: new Date().toISOString(),
      artifact: {
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
        status: artifact.status,
        isScopeExpansion: artifact.isScopeExpansion,
        structure: displayStructure,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
        completedAt: artifact.completedAt,
        parentArtifactId: artifact.parentArtifactId,
        parentSnapshotId: artifact.parentSnapshotId,
      },
      content: {
        body: displayBody,
        finishCriteria: displayFinishCriteria,
        finishSummary: displayFinishSummary,
        rtvTags: snapshot?.rtvTags || artifact.rtvTags,
      },
      snapshot: snapshot ? {
        id: snapshot.id,
        snapshotVersion: snapshot.snapshotVersion,
        createdAt: snapshot.createdAt,
      } : null,
    };

    const contentToHash = JSON.stringify({
      artifact: sealedDocument.artifact,
      content: sealedDocument.content,
      snapshot: sealedDocument.snapshot,
    });
    
    const encoder = new TextEncoder();
    const data = encoder.encode(contentToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    const finalDocument = {
      ...sealedDocument,
      _integrity: {
        algorithm: "SHA-256",
        hash: hashHex,
      },
    };

    const jsonString = JSON.stringify(finalDocument, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-zA-Z0-9]/g, "_")}_sealed.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const displayBody = snapshot?.body ?? artifact.body ?? "";
  const displayFinishCriteria = snapshot?.finishCriteria ?? artifact.finishCriteria;
  const displayFinishSummary = snapshot?.finishSummary ?? artifact.finishSummary;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {artifact.status === "archived" ? (
              <Badge variant="outline" className="text-xs">
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Badge>
            ) : (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {artifact.type}
            </Badge>
            {artifact.isScopeExpansion && (
              <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/50">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Scope Expansion
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-bold" data-testid="text-snapshot-title">{artifact.title}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Completed {artifact.completedAt && format(new Date(artifact.completedAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={handleExport}
            variant="outline"
            data-testid="button-export"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button 
            onClick={handleBlackBoxExport}
            variant="outline"
            data-testid="button-blackbox-export"
          >
            <Shield className="mr-2 h-4 w-4" />
            Sealed Export
          </Button>
          
          {artifact.status === "archived" ? (
            <Button 
              onClick={handleRestore}
              variant="outline"
              disabled={isArchiving}
              data-testid="button-restore"
            >
              {isArchiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="mr-2 h-4 w-4" />
              )}
              Restore
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleArchive}
                variant="outline"
                disabled={isArchiving}
                data-testid="button-archive"
              >
                {isArchiving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-2 h-4 w-4" />
                )}
                Archive
              </Button>
              
              <Button 
                onClick={() => setIsReviseDialogOpen(true)}
                variant="outline"
                data-testid="button-revise"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Create Revision
              </Button>
            </>
          )}
        </div>
      </div>

      {artifact.parentArtifactId && (
        <Card className="border-blue-500/20 bg-blue-500/5" data-testid="card-revision-info">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Revision Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <FileText className="h-4 w-4" />
              <span>Revised from artifact: {artifact.parentArtifactId}</span>
            </div>
            {isLoadingParent ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading parent for comparison...
              </div>
            ) : parentSnapshot ? (
              <DriftVisualization 
                current={snapshot?.structure ?? artifact.structure} 
                parent={parentSnapshot.structure} 
              />
            ) : (
              <div className="text-sm text-muted-foreground italic">
                Parent snapshot not available for comparison
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {displayFinishSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Finish Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{displayFinishSummary}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Content</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm" data-testid="text-snapshot-body">
                  {displayBody || <span className="text-muted-foreground italic">No content</span>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Audience</span>
                <Badge variant="outline">{artifact.structure.audience}</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(artifact.structure)
                  .filter(([key]) => key !== "audience")
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${value ? "bg-green-500" : "bg-muted"}`} />
                      <span className="text-xs truncate">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {displayFinishCriteria && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Finish Criteria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {displayFinishCriteria.doneDefinition}
                </p>
                <div className="space-y-1">
                  {displayFinishCriteria.checks.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {artifact.rtvTags && artifact.rtvTags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  RTV Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {artifact.rtvTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <RTVStatus rtv={rtv} />
        </div>
      </div>

      <Dialog open={isReviseDialogOpen} onOpenChange={setIsReviseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Create Revision
            </DialogTitle>
            <DialogDescription>
              Create a new draft based on this completed artifact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newTitle">New Title (optional)</Label>
              <Input
                id="newTitle"
                placeholder={`${artifact.title} (Revised)`}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                data-testid="input-revision-title"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-generate a title
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsReviseDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleRevise} disabled={isSubmitting} data-testid="button-confirm-revise">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Create Revision</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
