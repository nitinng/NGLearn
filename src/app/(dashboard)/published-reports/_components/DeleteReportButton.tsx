'use client';

import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { deletePublishedReport } from '@/app/actions/reports';
import { useRouter } from 'next/navigation';

export default function DeleteReportButton({ linkId, title }: { linkId: string; title: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the published report "${title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await deletePublishedReport(linkId);
      toast.success('Published report deleted');
      router.refresh();
    } catch (err) {
      toast.error('Failed to delete published report');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleDelete}
      disabled={isDeleting}
      title="Delete published report"
      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-border/80"
    >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </Button>
  );
}
