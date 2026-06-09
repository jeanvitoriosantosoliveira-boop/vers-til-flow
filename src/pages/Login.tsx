import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogIn, AlertCircle } from "lucide-react";

export default function Login() {
  const { user, ready, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (!r.ok) setErr(r.error ?? "Erro ao entrar");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-glow pointer-events-none" />
      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo size={56} />
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl">Versátil Digital</h1>
            <p className="text-sm text-muted-foreground">Entre para acessar a operação</p>
          </div>
        </div>

        <Card className="p-5 sm:p-6 shadow-lift">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setErr(null); }} required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setErr(null); }} required />
            </div>
            {err && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}
              </div>
            )}
            <Button type="submit" className="w-full gap-2 h-11" disabled={busy}>
              <LogIn className="w-4 h-4" /> {busy ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Card>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-6">por JVS Soluções & Versátil Digital</p>
      </div>
    </div>
  );
}
