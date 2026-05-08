import { useDroppable } from "@dnd-kit/core";
import type { Task, KanbanColumn } from "@/types";
import { TaskCard } from "./TaskCard";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface Props {
  column: KanbanColumn;
  tasks: Task[];
  onTaskClick: (id: string) => void;
  onAdd: (col: KanbanColumn) => void;
  canManage?: boolean;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
}

export function Column({ column, tasks, onTaskClick, onAdd, canManage, onRename, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.title);

  function commit() {
    const v = draft.trim();
    if (v && v !== column.title) onRename?.(column.id, v);
    setEditing(false);
  }

  return (
    <div className="flex flex-col bg-muted/70 dark:bg-muted/40 border border-border/60 rounded-xl p-3 min-w-[280px] w-[280px] shrink-0 shadow-sm">
      <div className="flex items-center justify-between px-1.5 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${column.accent}`} />
          {editing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(column.title); setEditing(false); } }}
              className="h-7 text-sm py-0"
            />
          ) : (
            <h3 className="font-semibold text-sm truncate">{column.title}</h3>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onAdd(column)} className="text-muted-foreground hover:text-accent transition-colors p-1 rounded hover:bg-background">
            <Plus className="w-4 h-4" />
          </button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-background">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setDraft(column.title); setEditing(true); }} className="gap-2">
                  <Pencil className="w-3.5 h-3.5" /> Renomear
                </DropdownMenuItem>
                {!column.base && (
                  <DropdownMenuItem onClick={() => onDelete?.(column.id)} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir coluna
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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