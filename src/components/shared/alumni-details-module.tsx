"use client";

import React from "react";
import Link from "next/link";
import {
  User,
  Building2,
  GraduationCap,
  Database,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CourseraAlumniStats from "@/app/(dashboard)/manage/master-data/_components/CourseraAlumniStats";

interface AlumniDetailsModuleProps {
  selectedAlumni: any;
  onClose: () => void;
}

export default function AlumniDetailsModule({
  selectedAlumni,
  onClose,
}: AlumniDetailsModuleProps) {
  if (!selectedAlumni) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-10 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border/80 rounded-2xl shadow-2xl max-w-[80vw] w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {selectedAlumni.name || "Alumni Details"}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {selectedAlumni.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            ✕
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <div className="space-y-4 bg-muted/20 border border-border/40 rounded-md p-5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-2">
                <User className="w-3.5 h-3.5" /> Personal Information
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Full Name
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Email ID
                  </span>
                  <span className="font-mono text-foreground">
                    {selectedAlumni.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Phone Number
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.phone_number || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Gender
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.gender || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Location
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.city || selectedAlumni.state
                      ? [selectedAlumni.city, selectedAlumni.state]
                          .filter(Boolean)
                          .join(", ")
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-4 bg-muted/20 border border-border/40 rounded-md p-5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-2">
                <GraduationCap className="w-4 h-4" /> Academic Info
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Campus Location
                  </span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {selectedAlumni.campus || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Course / School
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.course || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Admission / Entry Year
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.entry_year || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Professional Status */}
            <div className="space-y-4 bg-muted/20 border border-border/40 rounded-md p-5 md:col-span-2 lg:col-span-1">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-2">
                <Database className="w-3.5 h-3.5" /> Career & Status
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Current Status
                  </span>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border shadow-sm ${
                        selectedAlumni.status === "Placed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
                          : selectedAlumni.status === "Active"
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900"
                          : selectedAlumni.status === "DropOut"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900"
                          : "bg-muted text-muted-foreground border-border/80"
                      }`}
                    >
                      {selectedAlumni.status
                        ? selectedAlumni.status.toUpperCase()
                        : "—"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Placed Company
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.company || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Starting Position
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.starting_position || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Starting CTC (Annual)
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlumni.starting_salary
                      ? `₹${selectedAlumni.starting_salary.toLocaleString("en-IN")}`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Technology Stack
                  </span>
                  <div className="mt-1">
                    {selectedAlumni.technology_stack ? (
                      <Badge
                        variant="outline"
                        className="font-semibold px-2 py-0.5 rounded border-border/70 text-xs"
                      >
                        {selectedAlumni.technology_stack}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Administrative Details */}
          <div className="bg-muted/10 border border-border/40 rounded-md p-5 flex flex-col sm:flex-row justify-between gap-4 text-xs font-semibold text-muted-foreground md:col-span-2">
            <div className="flex items-center gap-2">
              <span>Donor Program Status:</span>
              <Badge
                variant="outline"
                className={`font-bold px-2 py-0.5 rounded-md border ${
                  selectedAlumni.donor &&
                  !["No", "no", "false", "none"].includes(selectedAlumni.donor)
                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {selectedAlumni.donor &&
                !["No", "no", "false", "none"].includes(selectedAlumni.donor)
                  ? selectedAlumni.donor.toUpperCase()
                  : "NON-DONOR"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>Record Imported At:</span>
              <span className="font-mono text-foreground">
                {selectedAlumni.created_at
                  ? new Date(selectedAlumni.created_at).toLocaleString("en-IN")
                  : "—"}
              </span>
            </div>
          </div>

          {/* Coursera Stats */}
          <CourseraAlumniStats email={selectedAlumni.email} />
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border/60 p-4 bg-muted/40 flex justify-end gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-md"
          >
            Close View
          </Button>
          <Link
            href={`/settings/data-management/record-history?email=${selectedAlumni.email}`}
            className="inline-flex items-center gap-1.5 text-xs text-white hover:text-white font-bold bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-md transition-all"
            onClick={onClose}
          >
            <Eye className="w-3.5 h-3.5" />
            View Detailed Audit History
          </Link>
        </div>
      </div>
    </div>
  );
}
