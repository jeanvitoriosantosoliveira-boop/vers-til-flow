import { useDroppable } from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";
import { Plus } from "lucide-react";

interface Props {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskClick: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
  accent: string;
}

export function Column({ status, title, tasks, onTaskClick, onAdd, accent }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col bg-muted/70 dark:bg-muted/40 border border-border/60 rounded-xl p-3 min-w-[280px] w-[280px] shrink-0 shadow-sm">
      <div className="flex items-center justify-between px-1.5 mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${accent}`} />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        </div>
        <button onClick={() => onAdd(status)} className="text-muted-foreground hover:text-accent transition-colors p-1 rounded hover:bg-background">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] flex-1 rounded-lg transition-colors ${isOver ? "bg-accent/10 ring-2 ring-accent/40" : ""}`}
      >
        {tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t.id)} />)}
      </div>
    </div>
  );
}