import { AlertTriangle } from 'lucide-react';

export function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <div role="alert" className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
        <div>
          <p className="font-medium">Cohort tracking couldn&rsquo;t load</p>
          <p className="mt-1 text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
