import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useApp } from "@/store/AppStore";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import { Trash2, Send, Play, Square } from "lucide-react";
import { formatSeconds } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  taskId: string | null;
  defaultStatus?: TaskStatus;
}

export function TaskDialog({ open, onOpenChange, taskId, defaultStatus }: Props) {
  const { tasks, clients, users, comments, currentUser, createTask, updateTask, deleteTask, addComment, startTimer, stopTimer, activeTimer } = useApp();
  const editing = tasks.find(t => t.id === taskId);
  const [form, setForm] = useState<Partial<Task>>({});
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ title: "", description: "", status: defaultStatus ?? "todo", priority: "medium", client_id: null, assignee_id: currentUser.id });
  }, [editing, defaultStatus, currentUser.id, open]);

  const taskComments = editing ? comments.filter(c => c.task_id === editing.id) : [];
  const isTiming = activeTimer?.taskId === editing?.id;

  async function save() {
    if (!form.title?.trim()) return;
    if (editing) await updateTask(editing.id, form);
    else await createTask(form);
    onOpenChange(false);
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
          </div>

          {editing && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tempo registrado</p>
                  <p className="font-display text-lg font-semibold tabular-nums">{formatSeconds(editing.total_seconds)}</p>
                </div>
                {isTiming ? (
                  <Button onClick={stopTimer} variant="destructive" size="sm" className="gap-2"><Square className="w-3 h-3" /> Parar</Button>
                ) : (
                  <Button onClick={() => startTimer(editing.id)} size="sm" className="gap-2"><Play className="w-3 h-3" /> Iniciar</Button>
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