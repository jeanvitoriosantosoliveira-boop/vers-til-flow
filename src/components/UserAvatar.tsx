import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}

type Props = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({ name, avatarUrl, className, fallbackClassName }: Props) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} className="object-cover" />
      <AvatarFallback className={cn("gradient-primary text-primary-foreground text-xs font-semibold", fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
