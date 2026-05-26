import { useDraggable } from "@dnd-kit/core";
import type { Task } from "@/types";
import { useApp } from "@/store/AppStore";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, Timer } from "lucide-react";
import { formatSeconds, relativeDue } from "@/lib/format";
import { UserAvatar } from "@/components/UserAvatar";

const priorityStyle: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/15 text-primary",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

const priorityLabel: Record<Task["priority"], string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};

export function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const { clients, users, comments } = useApp();
  const client = clients.find(c => c.id === task.client_id);
  const assignee = users.find(u => u.id === task.assignee_id);
  const due = relativeDue(task.due_date);
  const taskComments = comments.filter(c => c.task_id === task.id).length;

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border rounded-lg p-3.5 cursor-grab active:cursor-grabbing hover:shadow-elegant hover:border-accent/40 transition-all group ${
        isDragging ? "opacity-40 shadow-lift scale-[1.02]" : ""
      }`}
    >
      <div {...listeners} {...attributes} className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={`text-[10px] border-0 ${priorityStyle[task.priority]}`}>{priorityLabel[task.priority]}</Badge>
          {client && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{client.name}</span>}
        </div>
        <h4 onClick={onClick} className="font-medium text-sm leading-snug hover:text-accent cursor-pointer">{task.title}</h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${due.tone === "destructive" ? "text-destructive" : due.tone === "warning" ? "text-warning" : ""}`}>
                <Calendar className="w-3 h-3" /> {due.label}
              </span>
            )}
            {task.total_seconds > 0 && <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {formatSeconds(task.total_seconds)}</span>}
            {taskComments > 0 && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {taskComments}</span>}
          </div>
          {assignee && (
            <UserAvatar name={assignee.name} avatarUrl={assignee.avatar_url} className="w-6 h-6" fallbackClassName="text-[10px]" />
          )}
        </div>
      </div>
    </div>
  );
}