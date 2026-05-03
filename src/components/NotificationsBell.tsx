import { Bell, CheckCheck, Trash2, ListTodo, RefreshCw, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type Notification } from "@/context/NotificationsContext";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const icon: Record<Notification["type"], any> = {
  task_created: ListTodo,
  task_updated: RefreshCw,
  task_done: CheckCircle2,
  info: Info,
};
const tone: Record<Notification["type"], string> = {
  task_created: "text-primary bg-primary/10",
  task_updated: "text-warning bg-warning/10",
  task_done: "text-success bg-success/10",
  info: "text-accent bg-accent/10",
};

export function NotificationsBell() {
  const { notifications, unread, markAllRead, clear } = useNotifications();
  return (
    <Popover onOpenChange={(o) => o && unread > 0 && setTimeout(markAllRead, 1500)}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notificações</h4>
            {unread > 0 && <Badge variant="secondary" className="h-5 text-[10px]">{unread} novas</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead} disabled={unread === 0}>
              <CheckCheck className="w-3 h-3" /> Ler
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={clear} disabled={notifications.length === 0}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">Nenhuma notificação ainda.</p>
          ) : (
            notifications.map(n => {
              const Icon = icon[n.type];
              return (
                <div key={n.id} className={`flex gap-3 p-3 border-b border-border/60 last:border-0 ${!n.read ? "bg-accent/5" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone[n.type]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
