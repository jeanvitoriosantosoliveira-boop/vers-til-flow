import { useMemo, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Column } from "@/components/kanban/Column";
import { TaskDialog } from "@/components/kanban/TaskDialog";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { KanbanColumn, Task, TaskStatus } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearch } from "@/context/SearchContext";
import { PeriodFilter, type Period, inPeriod } from "@/components/PeriodFilter";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function columnOf(task: Task): string {
  return task.column_id || task.status;
}

export default function Kanban() {
  const navigate = useNavigate();
  const { tasks, clients, users, currentUser, moveTask, columns, createColumn, renameColumn, deleteColumn } = useApp();
  
  // Commercial users should not see task kanban - redirect to sales dashboard
  if (currentUser.role === "commercial") {
    navigate("/sales/dashboard");
    return null;
  }
  
  const { query, setQuery } = useSearch();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [defaultColumnId, setDefaultColumnId] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [period, setPeriod] = useState<Period>({ preset: "all" });
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");

  const isLeader = currentUser.role === "leader";
  const sortedColumns = useMemo(() => [...columns].sort((a,b) => a.order - b.order), [columns]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    // Templates de recorrência nunca aparecem no Kanban (apenas suas instâncias geradas)
    let list = tasks.filter(t => !t.is_template);
    if (currentUser.role !== "leader") {
      // gerente vê de subordinados também
      const isManager = currentUser.is_manager;
      const subordinateIds = new Set<string>([currentUser.id]);
      if (isManager) {
        users.forEach(u => {
          const utIds = u.team_ids ?? (u.team_id ? [u.team_id] : []);
          const myTeamIds = currentUser.team_ids ?? (currentUser.team_id ? [currentUser.team_id] : []);
          if (utIds.some(t => myTeamIds.includes(t))) subordinateIds.add(u.id);
        });
      }
      list = list.filter(t => (t.assignee_id && subordinateIds.has(t.assignee_id)) || t.created_by === currentUser.id);
    }
    if (filterClient !== "all") list = list.filter(t => t.client_id === filterClient);
    if (filterAssignee !== "all") list = list.filter(t => t.assignee_id === filterAssignee);

    // Período: considera due_date OU created_at
    if (period.preset !== "all") {
      list = list.filter(t => inPeriod(t.due_date, period) || inPeriod(t.created_at, period));
    }

    // Busca: título, descrição, cliente, responsável
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(t => {
        const client = clients.find(c => c.id === t.client_id)?.name.toLowerCase() ?? "";
        const assignee = users.find(u => u.id === t.assignee_id)?.name.toLowerCase() ?? "";
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          client.includes(q) ||
          assignee.includes(q) ||
          t.priority.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q)
        );
      });
    }

    return [...new Map(list.map((task) => [task.id, task])).values()];
  }, [tasks, currentUser, filterClient, filterAssignee, period, query, clients, users]);

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const targetId = e.over?.id ? String(e.over.id) : undefined;
    if (!targetId) return;
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const targetCol = columns.find(c => c.id === targetId);
    if (!targetCol) return;
    if (targetCol.base) {
      // Coluna base: atualiza status e limpa column_id
      moveTask(id, { status: targetCol.base as TaskStatus, column_id: null });
    } else {
      // Coluna customizada: mantém o status atual, só muda column_id
      moveTask(id, { column_id: targetCol.id, status: t.status });
    }
  }

  function openNew(col: KanbanColumn) {
    setEditingId(null);
    setDefaultStatus(col.base ?? "in_progress");
    setDefaultColumnId(col.base ? null : col.id);
    setOpen(true);
  }
  function openEdit(id: string) { setEditingId(id); setOpen(true); }

  function submitNewCol() {
    if (!newColTitle.trim()) return;
    createColumn(newColTitle.trim());
    setNewColTitle("");
    setNewColOpen(false);
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        title="Kanban"
        subtitle="Arraste e solte para mover tarefas entre colunas."
        actions={
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            {currentUser.role === "leader" && (
              <>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os responsáveis</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          <Button onClick={() => openNew(sortedColumns[0])} className="gap-2"><Plus className="w-4 h-4" /> Nova tarefa</Button>
          </>
        }
      />

      {query && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary" className="gap-2 pr-1">
            Buscando: <span className="font-semibold">{query}</span>
            <button onClick={() => setQuery("")} className="hover:bg-background/50 rounded p-0.5"><X className="w-3 h-3" /></button>
          </Badge>
          <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          {sortedColumns.map(col => (
            <Column
              key={col.id}
              column={col}
              tasks={filtered.filter(t => columnOf(t) === col.id)}
              onTaskClick={openEdit}
              onAdd={openNew}
              canManage={isLeader}
              onRename={renameColumn}
              onDelete={deleteColumn}
            />
          ))}
          {isLeader && (
            <button
              onClick={() => setNewColOpen(true)}
              className="min-w-[200px] w-[200px] shrink-0 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground hover:border-accent/50 hover:text-accent transition-colors gap-2"
            >
              <Plus className="w-4 h-4" /> Nova coluna
            </button>
          )}
        </div>
      </DndContext>

      <TaskDialog open={open} onOpenChange={setOpen} taskId={editingId} defaultStatus={defaultStatus} defaultColumnId={defaultColumnId} />

      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova coluna</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Nome da coluna</Label>
            <Input
              autoFocus
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              placeholder="Ex: Aguardando aprovação do cliente"
              onKeyDown={(e) => { if (e.key === "Enter") submitNewCol(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewColOpen(false)}>Cancelar</Button>
            <Button onClick={submitNewCol}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
