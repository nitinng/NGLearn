'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, Send, CheckCircle2, X } from 'lucide-react';
import { submitReportedIssue } from '@/app/actions/reports';
import { toast } from 'sonner';

interface ReportIssueModalProps {
  reportId?: string;
  triggerText?: string;
  triggerClassName?: string;
}

export default function ReportIssueModal({
  reportId,
  triggerText = 'Report an Issue',
  triggerClassName = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors shrink-0',
}: ReportIssueModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [formData, setFormData] = useState({
    reporter_name: '',
    reporter_email: '',
    issue_type: 'hour_discrepancy',
    description: '',
  });

  // Lock body scroll when modal is open to disable the page behind
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reporter_email || !formData.description) {
      toast.error('Please fill in required fields (Email & Description)');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitReportedIssue({
        report_id: reportId,
        ...formData,
      });
      setIsSubmitted(true);
      toast.success('Issue reported successfully! Thank you for your feedback.');
      setTimeout(() => {
        setIsSubmitted(false);
        setIsOpen(false);
        setFormData({
          reporter_name: '',
          reporter_email: '',
          issue_type: 'hour_discrepancy',
          description: '',
        });
      }, 2000);
    } catch (err) {
      toast.error('Failed to submit issue report. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalOverlay = isOpen ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl text-card-foreground p-6 sm:p-8 m-auto transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <X className="w-5 h-5" />
        </button>

        {isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
            <h3 className="text-xl font-bold tracking-tight">Report Received!</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Thank you for helping us refine NGLearn. Our team will review the reported metrics.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Report a Metric Issue or Variation
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Notice a difference in learning hours, completions, or group data? Let us know below.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reporter_name" className="text-xs font-semibold">
                  Your Name (Optional)
                </Label>
                <Input
                  id="reporter_name"
                  placeholder="e.g. Jane Doe"
                  value={formData.reporter_name}
                  onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reporter_email" className="text-xs font-semibold">
                  Your Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reporter_email"
                  type="email"
                  required
                  placeholder="name@navgurukul.org"
                  value={formData.reporter_email}
                  onChange={(e) => setFormData({ ...formData, reporter_email: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue_type" className="text-xs font-semibold">
                Issue Category
              </Label>
              <Select
                value={formData.issue_type}
                onValueChange={(val) => setFormData({ ...formData, issue_type: val })}
              >
                <SelectTrigger id="issue_type">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="hour_discrepancy">Learning Hours Discrepancy</SelectItem>
                  <SelectItem value="missing_completion">Course Completion Not Showing</SelectItem>
                  <SelectItem value="wrong_group_team">Incorrect Group or Team</SelectItem>
                  <SelectItem value="missing_learner">Learner Missing from List</SelectItem>
                  <SelectItem value="other">Other Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">
                Description of Discrepancy <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                required
                rows={4}
                placeholder="Describe what hours or details look incorrect (e.g. Expected ~15h but seeing 40h)..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Report
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{triggerText}</span>
      </button>

      {mounted && modalOverlay && createPortal(modalOverlay, document.body)}
    </>
  );
}

