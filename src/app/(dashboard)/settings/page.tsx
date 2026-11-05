import { redirect } from 'next/navigation';
import { getUserRole, USER_MANAGER_ROLES } from '@/lib/roles';
import { EDIT_ROLES } from '@/lib/access';
import Link from 'next/link';
import { Settings, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageShell, PageHeader } from '@/components/page-shell';
import { Shield, Target } from 'lucide-react';

const SETTINGS_CARDS = [
  {
    href: '/settings/users',
    label: 'User Roles',
    description: 'Manage application access and assign user roles.',
    icon: Shield,
    badge: 'Admin / PNC / CEOs',
    gradient: 'from-emerald-500/10 via-green-500/5 to-transparent',
    border: 'hover:border-emerald-500/30 dark:hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white',
    roles: USER_MANAGER_ROLES,
  },
  {
    href: '/settings/targets',
    label: 'Coursera Targets',
    description: 'Weekly learning-hours target (default 5 h) that decides who is "on target", and the inactivity threshold.',
    icon: Target,
    badge: 'Admin / PNC / Program',
    gradient: 'from-indigo-500/10 via-violet-500/5 to-transparent',
    border: 'hover:border-indigo-500/30 dark:hover:border-indigo-500/50',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white',
    roles: EDIT_ROLES,
  },
];

export default async function SettingsPage() {
  const role = await getUserRole();
  if (!USER_MANAGER_ROLES.includes(role) && !EDIT_ROLES.includes(role)) redirect('/');

  return (
    <PageShell className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="Settings"
        icon={Settings}
        description="User access, roles and Coursera targets."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SETTINGS_CARDS.filter(card => card.roles.includes(role)).map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="group block">
              <Card className={`h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1 group-hover:shadow-lg ${card.border}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-all duration-300 text-muted-foreground">
                  <ArrowRight className="w-4 h-4 translate-x-[-8px] group-hover:translate-x-0 transition-transform" />
                </div>
                <CardHeader className="flex flex-col items-start gap-4 space-y-0 relative z-10">
                  <div className="flex flex-row items-center gap-4 pr-6 w-full">
                    <div className={`p-3 rounded-xl transition-all duration-300 ${card.iconBg} shadow-sm group-hover:scale-105 group-hover:rotate-3 shrink-0 flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      <CardTitle className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary dark:group-hover:text-white transition-colors duration-300 leading-none">
                        {card.label}
                      </CardTitle>
                      <div className="flex items-center">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">{card.badge}</Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground/95 transition-colors duration-300 w-full">
                    {card.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
