"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Globe } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export function SeriesCard({ series, subContests }: { series: any; subContests: any[] }) {

  const getAccent = (name: string) => {
    const colors = ["bg-blue-500", "bg-emerald-500", "bg-rose-500", "bg-purple-500", "bg-orange-500"];
    let hash = 0;
    if (name) {
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  const accentClass = getAccent(series?.name || "");

  return (
    <Card
      className="group flex flex-row overflow-hidden border-border bg-card rounded-md transition-shadow"
    >
      {/* Accent Block */}
      <div className={`w-2 shrink-0 ${accentClass}`} />
      
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between p-4 gap-4">
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-lg font-bold tracking-tight text-foreground truncate">
              {series.name}
            </h3>
          </div>
        </div>

        <div className="px-4 pb-4 border-t border-border/50 pt-4">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Contest Name</th>
                  <th className="px-4 py-2 font-medium">Start Date</th>
                  <th className="px-4 py-2 font-medium">End Date</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subContests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground italic">No contests active</td>
                  </tr>
                ) : (
                  subContests.map((sc: any) => (
                    <tr key={sc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{sc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(sc.start_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(sc.end_date)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sc.publishedReportId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-8 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/50 dark:hover:bg-blue-900/20"
                            >
                              <Link
                                href={`/p/${sc.publishedReportId}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="w-3.5 h-3.5" /> Published
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast.success("Publish functionality coming soon!");
                              }}
                              className="h-8 gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:hover:bg-emerald-900/20"
                            >
                              <Globe className="w-3.5 h-3.5" /> Publish
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            asChild
                            className="h-8 gap-1.5"
                          >
                            <Link
                              href={`/contests/coursera?contest=${sc.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}
