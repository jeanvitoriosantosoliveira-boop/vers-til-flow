import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useApp } from "@/store/AppStore";
import type { Task, TaskPriority, TaskStatus, RecurrenceMode } from "@/types";
import { Trash2, Send, Plus, Clock, Trash, Repeat } from "lucide-react";
import { formatSeconds, formatDate } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  taskId: string | null;
  defaultStatus?: TaskStatus;
  defaultColumnId?: string | null;
}

export function TaskDialog({ open, onOpenChange, taskId, defaultStatus, defaultColumnId }: Props) {
  const { tasks, clients, users, comments, timeEntries, currentUser, createTask, updateTask, deleteTask, addComment, logTime, deleteTimeEntry } = useApp();
  const editing = tasks.find(t => t.id === taskId);
  const [form, setForm] = useState<Partial<Task>>({});
  const [comment, setComment] = useState("");
  const [hoursStr, setHoursStr] = useState("");
  const [minutesStr, setMinutesStr] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ title: "", description: "", status: defaultStatus ?? "todo", priority: "medium", client_id: null, assignee_id: currentUser.id, column_id: defaultColumnId ?? null, recurrence: { mode: "none", interval: 1 } });
  }, [editing, defaultStatus, defaultColumnId, currentUser.id, open]);

  const taskComments = editing ? comments.filter(c => c.task_id === editing.id) : [];
  const taskLogs = useMemo(
    () => editing ? timeEntries.filter(t => t.task_id === editing.id).sort((a,b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()) : [],
    [timeEntries, editing]
  );

  async function save() {
    if (!form.title?.trim()) return;
    if (editing) await updateTask(editing.id, form);
    else await createTask(form);
    onOpenChange(false);
  }

  async function submitTimeLog() {
    if (!editing) return;
    const h = parseFloat(hoursStr || "0") || 0;
    const m = parseFloat(minutesStr || "0") || 0;
    const seconds = Math.round(h * 3600 + m * 60);
    if (seconds <= 0) return;
    await logTime({ task_id: editing.id, seconds, description: logDesc.trim() || undefined, logged_at: new Date(logDate).toISOString() });
    setHoursStr(""); setMinutesStr(""); setLogDesc("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Título</Label>
            <Input value={form.title ?? ""} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="O que precisa ser feito?" autoFocus />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="review">Em Revisão</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id ?? "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.assignee_id ?? "none"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Prazo</Label>
              <Input type="date" value={form.due_date?.slice(0, 10) ?? ""} onChange={e => setForm({ ...form, due_date: e.target.value || null })} />
            </div>
            <div className="col-span-2">
              <Label className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5 text-accent" /> Recorrência</Label>
              <div className="flex gap-2">
                <Select value={form.recurrence?.mode ?? "none"} onValueChange={(v) => setForm({ ...form, recurrence: { ...(form.recurrence ?? {}), mode: v as RecurrenceMode, interval: form.recurrence?.interval ?? 1 } })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não repetir</SelectItem>
                    <SelectItem value="hourly">A cada N horas</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
                {form.recurrence?.mode && form.recurrence.mode !== "none" && (
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={form.recurrence?.interval ?? 1}
                    onChange={(e) => setForm({ ...form, recurrence: { ...(form.recurrence ?? { mode: "daily" }), interval: Math.max(1, +e.target.value || 1) } })}
                  />
                )}
              </div>
              {form.recurrence?.mode && form.recurrence.mode !== "none" && (
                <p className="text-[10px] text-muted-foreground mt-1">Ao concluir, uma nova ocorrência será agendada automaticamente.</p>
              )}
            </div>
          </div>

          {editing && (
            <div className="border-t border-border pt-4 space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" />
                    <p className="text-sm font-semibold">Lançamento de horas</p>
                  </div>
                  <p className="font-display text-lg font-bold tabular-nums">{formatSeconds(editing.total_seconds)}</p>
                </div>
                <div className="grid grid-cols-12 gap-2 mb-2">
                  <div className="col-span-2">
                    <Label className="text-[10px] uppercase">Horas</Label>
                    <Input type="number" min="0" step="1" value={hoursStr} onChange={(e) => setHoursStr(e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px] uppercase">Min</Label>
                    <Input type="number" min="0" max="59" step="5" value={minutesStr} onChange={(e) => setMinutesStr(e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px] uppercase">Data</Label>
                    <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                  </div>
                  <div className="col-span-5">
                    <Label className="text-[10px] uppercase">O que foi feito</Label>
                    <Input value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder="Ex: edição do vídeo case 1" />
                  </div>
                </div>
                <Button size="sm" onClick={submitTimeLog} className="w-full gap-2"><Plus className="w-3 h-3" /> Lançar horas</Button>

                {taskLogs.length > 0 && (
                  <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
                    {taskLogs.map(l => {
                      const u = users.find(x => x.id === l.user_id);
                      const canDelete = currentUser.role === "leader" || l.user_id === currentUser.id;
                      return (
                        <div key={l.id} className="flex items-center gap-3 text-xs p-2 rounded-md bg-background/60 border border-border/60">
                          <span className="font-display font-bold tabular-nums text-accent w-16">{formatSeconds(l.seconds)}</span>
                          <span className="flex-1 truncate">{l.description || <em className="text-muted-foreground">sem descrição</em>}</span>
                          <span className="text-muted-foreground tabular-nums">{formatDate(l.logged_at)}</span>
                          <span className="text-muted-foreground hidden sm:inline">· {u?.name.split(" ")[0]}</span>
                          {canDelete && (
                            <button onClick={() => deleteTimeEntry(l.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Label>Comentários</Label>
                <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                  {taskComments.map(c => {
                    const u = users.find(x => x.id === c.user_id);
                    return (
                      <div key={c.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="text-xs font-semibold text-accent mb-1">{u?.name}</p>
                        <p>{c.body}</p>
                      </div>
                    );
                  })}
                  {!taskComments.length && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
                </div>
                <div className="flex gap-2">
                  <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário…" onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { addComment(editing.id, comment); setComment(""); }}} />
                  <Button size="icon" variant="secondary" onClick={() => { if (comment.trim()) { addComment(editing.id, comment); setComment(""); } }}><Send className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {editing && currentUser.role === "leader" && (
            <Button variant="outline" onClick={() => { deleteTask(editing.id); onOpenChange(false); }} className="mr-auto gap-2 text-destructive hover:text-destructive">
              <Trash2 className="w-3 h-3" /> Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? "Salvar" : "Criar tarefa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}