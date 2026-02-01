import { useEffect, useMemo, useState } from "react";
import { createArtifact, getArtifact, updateArtifact, type ArtifactGetResponse } from "@/lib/api";
import type { ArtifactStructure, ArtifactType, FinishCriteria, ArtifactRecord } from "@shared/schema";
import { DEFAULT_STRUCTURE } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Plus, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const ARTIFACT_TYPES: ArtifactType[] = [
  "note", "sop", "checklist", "playbook", "template", 
  "workflow", "spec", "principles", "journal", "other"
];

const STRUCTURE_FIELDS: { key: keyof Omit<ArtifactStructure, "audience">; label: string }[] = [
  { key: "includesWhy", label: "Includes Why" },
  { key: "reusable", label: "Reusable" },
  { key: "hasStepsOrProcess", label: "Has Steps/Process" },
  { key: "coordinatesToolsOrAgents", label: "Coordinates Tools/Agents" },
  { key: "expressesValues", label: "Expresses Values" },
  { key: "thinkingOnly", label: "Thinking Only" },
];

interface ArtifactEditorProps {
  artifactId: string | null;
  onCreated: (id: string) => void;
  refreshList: () => void;
}

function safeParseChecks(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

export function ArtifactEditor({ artifactId, onCreated, refreshList }: ArtifactEditorProps) {
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactRecord | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ArtifactType>("note");
  const [body, setBody] = useState("");
  const [structure, setStructure] = useState<ArtifactStructure>(DEFAULT_STRUCTURE);
  const [isScopeExpansion, setIsScopeExpansion] = useState(false);

  const [doneDefinition, setDoneDefinition] = useState("");
  const [checksText, setChecksText] = useState("");

  const finishCriteria: FinishCriteria | undefined = useMemo(() => {
    const checks = safeParseChecks(checksText);
    if (!doneDefinition.trim() && checks.length === 0) return undefined;
    return { 
      doneDefinition: doneDefinition.trim() || "Define done.", 
      checks: checks.length ? checks : ["Add at least one check."] 
    };
  }, [doneDefinition, checksText]);

  async function load(id: string) {
    setError(null);
    setIsLoading(true);
    try {
      const r = await getArtifact(id);
      const art = r.artifact;
      setArtifact(art);
      
      if (art.status === "complete") {
        setMode("edit");
        const snap = (r as any).snapshot;
        setTitle(art.title);
        setType(art.type);
        setBody(snap?.body ?? art.body ?? "");
        setStructure(art.structure);
        setIsScopeExpansion(art.isScopeExpansion);
        setDoneDefinition(snap?.finishCriteria?.doneDefinition ?? art.finishCriteria?.doneDefinition ?? "");
        setChecksText((snap?.finishCriteria?.checks ?? art.finishCriteria?.checks ?? []).join("\n"));
      } else {
        setMode("edit");
        const rr = r as ArtifactGetResponse & { body?: string };
        setTitle(art.title);
        setType(art.type);
        setBody(rr.body ?? art.body ?? "");
        setStructure(art.structure);
        setIsScopeExpansion(art.isScopeExpansion);
        setDoneDefinition(art.finishCriteria?.doneDefinition ?? "");
        setChecksText((art.finishCriteria?.checks ?? []).join("\n"));
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!artifactId) {
      setMode("create");
      setArtifact(null);
      setTitle("");
      setType("note");
      setBody("");
      setStructure(DEFAULT_STRUCTURE);
      setIsScopeExpansion(false);
      setDoneDefinition("");
      setChecksText("");
      setError(null);
      return;
    }
    load(artifactId);
  }, [artifactId]);

  async function handleCreate() {
    setError(null);
    setIsSaving(true);
    try {
      const result = await createArtifact({
        title,
        type,
        body,
        structure,
        finishCriteria,
        isScopeExpansion,
      });
      onCreated(result.artifact.id);
      refreshList();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    if (!artifactId) return;
    setError(null);
    setIsSaving(true);
    try {
      await updateArtifact(artifactId, {
        title,
        type,
        body,
        structure,
        finishCriteria,
        isScopeExpansion,
      });
      refreshList();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const isComplete = artifact?.status === "complete";

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            mode === "create" ? "bg-primary/10" : isComplete ? "bg-green-500/10" : "bg-muted"
          )}>
            {mode === "create" ? (
              <Plus className="h-5 w-5 text-primary" />
            ) : isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold" data-testid="text-editor-title">
              {mode === "create" ? "Create Artifact" : "Edit Artifact"}
            </h2>
            {artifact && (
              <Badge variant={isComplete ? "default" : "secondary"} className="mt-1">
                {artifact.status}
              </Badge>
            )}
          </div>
        </div>
        
        {mode === "create" ? (
          <Button onClick={handleCreate} disabled={isSaving || !title.trim()} data-testid="button-create-save">
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" /> Create</>
            )}
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={isSaving || isComplete} data-testid="button-save-draft">
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save Draft</>
            )}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-editor-error">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter artifact title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isComplete}
              data-testid="input-title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ArtifactType)} disabled={isComplete}>
              <SelectTrigger id="type" data-testid="select-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ARTIFACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg border",
          isScopeExpansion ? "border-amber-500/50 bg-amber-500/5" : "border-border"
        )}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={cn(
              "h-4 w-4",
              isScopeExpansion ? "text-amber-500" : "text-muted-foreground"
            )} />
            <div className="space-y-0.5">
              <Label htmlFor="scope-expansion" className="text-sm font-medium cursor-pointer">
                Scope Expansion
              </Label>
              <p className="text-xs text-muted-foreground">
                Is this outside your original cycle goal?
              </p>
            </div>
          </div>
          <Switch
            id="scope-expansion"
            checked={isScopeExpansion}
            onCheckedChange={setIsScopeExpansion}
            disabled={isComplete}
            data-testid="switch-scope-expansion"
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select 
                value={structure.audience} 
                onValueChange={(v) => setStructure({ ...structure, audience: v as "internal" | "external" | "unknown" })}
                disabled={isComplete}
              >
                <SelectTrigger id="audience" data-testid="select-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {STRUCTURE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={structure[key]}
                    onCheckedChange={(checked) => 
                      setStructure({ ...structure, [key]: checked === true })
                    }
                    disabled={isComplete}
                    data-testid={`checkbox-${key}`}
                  />
                  <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Finish Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doneDefinition">Done Definition</Label>
              <Input
                id="doneDefinition"
                placeholder="What must be true for this to be done?"
                value={doneDefinition}
                onChange={(e) => setDoneDefinition(e.target.value)}
                disabled={isComplete}
                data-testid="input-done-definition"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checks">Checks (one per line)</Label>
              <Textarea
                id="checks"
                placeholder="Enter completion checks, one per line"
                value={checksText}
                onChange={(e) => setChecksText(e.target.value)}
                rows={4}
                disabled={isComplete}
                data-testid="textarea-checks"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            placeholder="Enter the content of your artifact..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            disabled={isComplete}
            className="font-mono text-sm"
            data-testid="textarea-body"
          />
        </div>
      </div>
    </div>
  );
}
