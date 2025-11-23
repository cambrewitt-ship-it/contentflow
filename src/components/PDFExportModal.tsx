'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PDFExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (pdfTitle: string, pdfFileName: string) => void;
  defaultTitle?: string;
  defaultFileName?: string;
}

export function PDFExportModal({
  open,
  onClose,
  onExport,
  defaultTitle = 'Content Calendar',
  defaultFileName = `content-calendar-${new Date().toISOString().split('T')[0]}`,
}: PDFExportModalProps) {
  const [pdfTitle, setPdfTitle] = useState(defaultTitle);
  const [pdfFileName, setPdfFileName] = useState(defaultFileName);

  // Update state when defaults change or modal opens
  useEffect(() => {
    if (open) {
      setPdfTitle(defaultTitle);
      setPdfFileName(defaultFileName);
    }
  }, [open, defaultTitle, defaultFileName]);

  const handleExport = () => {
    if (!pdfTitle.trim() || !pdfFileName.trim()) {
      alert('Please fill in both fields');
      return;
    }
    onExport(pdfTitle.trim(), pdfFileName.trim());
  };

  const handleClose = () => {
    // Reset to defaults when closing
    setPdfTitle(defaultTitle);
    setPdfFileName(defaultFileName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white opacity-100">
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>
            Customize your PDF export settings
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="pdf-title" className="text-sm font-medium">
              PDF Title
            </label>
            <input
              id="pdf-title"
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="Content Calendar"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              This title will appear at the top of the PDF
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="pdf-filename" className="text-sm font-medium">
              File Name
            </label>
            <input
              id="pdf-filename"
              type="text"
              value={pdfFileName}
              onChange={(e) => setPdfFileName(e.target.value)}
              placeholder="content-calendar-2025-11-23"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              The PDF will be saved with this name (no .pdf extension needed)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

