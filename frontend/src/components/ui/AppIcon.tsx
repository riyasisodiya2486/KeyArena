import {
  Award, CalendarDays, Users, Radio, Eye, Trash2, BarChart3,
  TrendingUp, Flag, Trophy, Link2, Gauge, Flame, Rocket, Dumbbell, Sprout,
  CircleHelp, Clipboard, Check, type LucideIcon,
} from "lucide-react";

const icons = {
  award: Award, calendar: CalendarDays, users: Users, live: Radio, view: Eye,
  delete: Trash2, chart: BarChart3, trend: TrendingUp,
  flag: Flag, trophy: Trophy, link: Link2, gauge: Gauge, flame: Flame,
  rocket: Rocket, strength: Dumbbell, growth: Sprout, help: CircleHelp,
  copy: Clipboard, check: Check,
} satisfies Record<string, LucideIcon>;

export function AppIcon({ name, size = 18, className = "" }: {
  name: keyof typeof icons;
  size?: number;
  className?: string;
}) {
  const Icon = icons[name];
  return <Icon size={size} className={className} aria-hidden="true" />;
}
