import { useMemo, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Column } from "@/components/kanban/Column";
import { TaskDialog } from "@/components/kanban/TaskDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { TaskStatus } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLUMNS: { status: TaskStatus; title: string; accent: string }[] = [
  { status: "todo", title: "A Fazer", accent: "bg-muted-foreground" },
  { status: "in_progress", title: "Em Andamento", accent: "bg-primary" },
  { status: "review", title: "Em Revisão", accent: "bg-warning" },
  { status: "done", title: "Concluído", accent: "bg-success" },
];

export default function Kanban() {
  const { tasks, clients, users, currentUser, moveTask } = useApp();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    let list = currentUser.role === "leader" ? tasks : tasks.filter(t => t.assignee_id === currentUser.id);
    if (filterClient !== "all") list = list.filter(t => t.client_id === filterClient);
    if (filterAssignee !== "all") list = list.filter(t => t.assignee_id === filterAssignee);
    return list;
  }, [tasks, currentUser, filterClient, filterAssignee]);

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const target = e.over?.id as TaskStatus | undefined;
    if (!target) return;
    const t = tasks.find(x => x.id === id);
    if (t && t.status !== target) moveTask(id, target);
  }

  function openNew(status: TaskStatus) {
    setEditingId(null);
    setDefaultStatus(status);
    setOpen(true);
  }
  function openEdit(id: string) {
    setEditingId(id);
    setOpen(true);
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        title="Kanban"
        subtitle="Arraste e solte para mover tarefas entre colunas."
        actions={
          <>
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
            <Button onClick={() => openNew("todo")} className="gap-2"><Plus className="w-4 h-4" /> Nova tarefa</Button>
          </>
        }
      />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          {COLUMNS.map(col => (
            <Column
              key={col.status}
              status={col.status}
              title={col.title}
              accent={col.accent}
              tasks={filtered.filter(t => t.status === col.status)}
              onTaskClick={openEdit}
              onAdd={openNew}
            />
          ))}
        </div>
      </DndContext>

      <TaskDialog open={open} onOpenChange={setOpen} taskId={editingId} defaultStatus={defaultStatus} />
    </div>
  );
}