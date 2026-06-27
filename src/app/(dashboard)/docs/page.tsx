import React from "react";
import Link from "next/link";
import {
  BookOpen,
  Layers,
  Users,
  Database,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
  ArrowLeft
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function DocumentationPage() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-primary/5 rounded-md filter blur-[80px] pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-purple-500/5 rounded-md filter blur-[100px] pointer-events-none -z-10" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-primary/10 to-purple-500/10 text-primary rounded-md border border-primary/20 shadow-inner">
            <BookOpen className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground/80">
              System Documentation
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Access guidelines, component design systems, and data management documentation.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid of Documentation Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Components Showcase - ACTIVE */}
        <Link href="/docs/components" className="group block h-full">
          <Card className="h-full border border-primary/20 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1 group-hover:shadow-lg hover:border-primary/50 rounded-md">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-all duration-300 text-primary">
              <ArrowRight className="w-4 h-4 translate-x-[-8px] group-hover:translate-x-0 transition-transform" />
            </div>

            <CardHeader className="flex flex-row items-start gap-4 space-y-0 relative z-10 pb-4">
              <div className="p-3 rounded-sm bg-primary/10 text-primary transition-all duration-300 shadow-sm group-hover:scale-105 group-hover:rotate-3 group-hover:bg-primary group-hover:text-white">
                <Layers className="w-5 h-5" />
              </div>
              <div className="space-y-1 pr-6 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary dark:group-hover:text-white transition-colors duration-300">
                    Components Showcase
                  </CardTitle>
                  <span className="text-[9px] px-2 py-0.5 font-bold rounded-md bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest">
                    Interactive
                  </span>
                </div>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground mt-1 group-hover:text-foreground/95 transition-colors duration-300">
                  Comprehensive style guide demonstrating all pre-installed UI components, layouts, forms, and overlays.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground border-t border-border/40 pt-4 mt-2 bg-muted/30">
              Includes: Typography, Buttons, Forms, Modals, Skeleton loaders, and Table structures.
            </CardContent>
          </Card>
        </Link>

        {/* Roles & Access Control - PLACEHOLDER */}
        <Card className="h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group rounded-md">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
            <div className="p-3 rounded-md bg-slate-500/10 text-slate-500 dark:text-slate-400 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                  Access & Roles
                </CardTitle>
                <span className="text-[9px] px-2 py-0.5 font-bold rounded-md bg-secondary border border-border text-muted-foreground uppercase tracking-widest">
                  Docs
                </span>
              </div>
              <CardDescription className="text-sm leading-relaxed text-muted-foreground mt-1">
                Detailed matrix mapping permissions across Super Admins, Admins, and Internal users.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground border-t border-border/40 pt-4 mt-2 bg-muted/30">
            Learn about Dev Override cookies and role checking hooks inside application routes.
          </CardContent>
        </Card>

        {/* Data Schema & Mappings - PLACEHOLDER */}
        <Card className="h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group rounded-md">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
            <div className="p-3 rounded-md bg-slate-500/10 text-slate-500 dark:text-slate-400 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                  Data Schema Mapping
                </CardTitle>
                <span className="text-[9px] px-2 py-0.5 font-bold rounded-md bg-secondary border border-border text-muted-foreground uppercase tracking-widest">
                  Schema
                </span>
              </div>
              <CardDescription className="text-sm leading-relaxed text-muted-foreground mt-1">
                Reference guidelines for importing organizational CSV/Excel files into Supabase tables.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground border-t border-border/40 pt-4 mt-2 bg-muted/30">
            Covers mapping algorithms, duplicate detection, verification procedures, and rollback points.
          </CardContent>
        </Card>
      </div>

      {/* Info Banner Section */}
      <Card className="border border-border bg-gradient-to-r from-purple-500/5 via-primary/5 to-transparent relative overflow-hidden rounded-md">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-foreground">Need help developing new components?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Refer to the <strong>Components Showcase</strong> style guide for styling examples using Tailwind, Lucide React icons, and Radix UI primitives.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
