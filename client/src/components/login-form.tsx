import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Zap } from "lucide-react";
import { issueToken, setToken, setUserId } from "@/lib/api";

interface LoginFormProps {
  onLogin: () => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [userId, setUserInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) {
      setError("Please enter a user ID");
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const result = await issueToken(userId.trim());
      setToken(result.token);
      setUserId(userId.trim());
      onLogin();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
              <Zap className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Proof of Work
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Track your artifacts with discipline and clarity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="Enter your user ID"
                value={userId}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isLoading}
                data-testid="input-user-id"
                className="h-11"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-login-error">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full h-11" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
          
          <p className="mt-6 text-center text-xs text-muted-foreground">
            MVP authentication — no password required
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
