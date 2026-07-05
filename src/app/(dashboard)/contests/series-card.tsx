"use client";

import { Card } from "@/components/ui/card";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function SeriesCard({ series, subContests }: { series: any; subContests: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const mainLink = subContests.length > 0 ? `/contests/coursera?contest=${subContests[0].id}` : `/contests/coursera`;

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
      onClick={() => setExpanded(!expanded)}
      className="group flex flex-row overflow-hidden border-border bg-card rounded-md cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Accent Block */}
      <div className={`w-2 shrink-0 ${accentClass}`} />
      
      <div className="flex flex-col flex-1 p-5 gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground truncate">
              {series.name}
            </h3>
            {series.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {series.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-md">
            <span>{subContests.length} Sub-Contests</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </div>
          <Link
            href={mainLink}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline ml-auto"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {expanded && (
          <div className="mt-4 border border-border rounded-md overflow-hidden animate-in slide-in-from-top-2">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Contest Name</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subContests.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground italic">No contests active</td>
                  </tr>
                ) : (
                  subContests.map((sc: any) => (
                    <tr key={sc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{sc.name}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/contests/coursera?contest=${sc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-semibold"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
