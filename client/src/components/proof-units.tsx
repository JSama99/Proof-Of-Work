import { useEffect, useState } from "react";
import { addProofUnit, listProofUnits } from "@/lib/api";
import type { ProofUnitRecord, ProofMode, ProofType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Loader2, 
  Zap, 
  Rocket, 
  GitBranch, 
  FileCode, 
  Cog, 
  Search,
  User,
  Crown
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProofUnitsProps {
  artifactId: string | null;
  onProofAdded?: () => void;
}

const PROOF_TYPES: { value: ProofType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "ship", label: "Ship", icon: Rocket, color: "text-blue-500" },
  { value: "decide", label: "Decide", icon: GitBranch, color: "text-purple-500" },
  { value: "document", label: "Document", icon: FileCode, color: "text-green-500" },
  { value: "automate", label: "Automate", icon: Cog, color: "text-orange-500" },
  { value: "review", label: "Review", icon: Search, color: "text-cyan-500" },
];

const MODE_ICONS: Record<ProofMode, React.ElementType> = {
  operator: User,
  steward: Crown,
};

export function ProofUnits({ artifactId, onProofAdded }: ProofUnitsProps) {
  const [units, setUnits] = useState<ProofUnitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mode, setMode] = useState<ProofMode>("operator");
  const [proofType, setProofType] = useState<ProofType>("document");
  const [note, setNote] = useState("");

  async function load() {
    if (!artifactId) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await listProofUnits(artifactId);
      setUnits(result.proofUnits);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setUnits([]);
    if (artifactId) load();
  }, [artifactId]);

  async function handleSubmit() {
    if (!artifactId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addProofUnit(artifactId, { 
        mode, 
        proofType, 
        note: note.trim() || undefined 
      });
      setNote("");
      await load();
      onProofAdded?.();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!artifactId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select an artifact to manage proof units</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Proof Units
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-proof-error">
            {error}
          </div>
        )}
        
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ProofMode)}>
              <SelectTrigger data-testid="select-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Operator
                  </div>
                </SelectItem>
                <SelectItem value="steward">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Steward
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Proof Type</Label>
            <Select value={proofType} onValueChange={(v) => setProofType(v as ProofType)}>
              <SelectTrigger data-testid="select-proof-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROOF_TYPES.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="proofNote">Note (optional)</Label>
          <Input
            id="proofNote"
            placeholder="Add a note about this proof..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="input-proof-note"
          />
        </div>
        
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting} 
          className="w-full"
          data-testid="button-add-proof"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
          ) : (
            <><Plus className="mr-2 h-4 w-4" /> Add Proof Unit</>
          )}
        </Button>

        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3">History ({units.length})</h4>
          
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No proof units yet
            </p>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {units.map((unit) => {
                  const proofConfig = PROOF_TYPES.find(p => p.value === unit.proofType);
                  const ProofIcon = proofConfig?.icon || Zap;
                  const ModeIcon = MODE_ICONS[unit.mode];
                  
                  return (
                    <div 
                      key={unit.id}
                      className="flex items-start gap-3 p-3 rounded-md bg-muted/50 border"
                      data-testid={`proof-unit-${unit.id}`}
                    >
                      <div className={cn("p-2 rounded-md bg-background", proofConfig?.color)}>
                        <ProofIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            <ModeIcon className="h-3 w-3 mr-1" />
                            {unit.mode}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {unit.proofType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(unit.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {unit.note && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {unit.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
