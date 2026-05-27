import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}

type Props = ComponentPropsWithoutRef<typeof Avatar> & {
  name: string;
  avatarUrl?: string | null;
  fallbackClassName?: string;
};

export const UserAvatar = forwardRef<ElementRef<typeof Avatar>, Props>(
  ({ name, avatarUrl, className, fallbackClassName, ...props }, ref) => {
  return (
    <Avatar ref={ref} className={cn("shrink-0", className)} {...props}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} className="object-cover" />
      <AvatarFallback className={cn("gradient-primary text-primary-foreground text-xs font-semibold", fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
});

UserAvatar.displayName = "UserAvatar";
