import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function ClientAvatar({ name, logoUrl, className, fallbackClassName }: Props) {
  const letter = name.charAt(0).toUpperCase() || "?";
  return (
    <Avatar className={cn("shrink-0 rounded-lg", className)}>
      <AvatarImage src={logoUrl ?? undefined} alt={name} className="object-cover rounded-lg" />
      <AvatarFallback className={cn("rounded-lg gradient-primary text-primary-foreground font-semibold", fallbackClassName)}>
        {letter}
      </AvatarFallback>
    </Avatar>
  );
}
