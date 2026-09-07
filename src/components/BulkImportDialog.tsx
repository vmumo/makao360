import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, Loader2, FileSpreadsheet } from "lucide-react";

export type ImportResult = { ok: number; failed: number; errors: string[] };

type Props = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  templateRows: Record<string, string | number>[];
  templateFilename: string;
  /** Called once with all parsed rows. Should return an ImportResult. */
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportResult>;
  onDone?: () => void;
};

export function BulkImportDialog({
  trigger, title, description, templateRows, templateFilename, onImport, onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFilename);
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      setRows(data);
      toast.success(`Loaded ${data.length} rows from ${file.name}`);
    } catch (e) {
      toast.error("Failed to read file: " + (e as Error).message);
    }
  };

  const runImport = async () => {
    if (!rows?.length) { toast.error("Pick a file first"); return; }
    setBusy(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      if (res.failed === 0) toast.success(`Imported ${res.ok} rows`);
      else toast.warning(`Imported ${res.ok}, ${res.failed} failed`);
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setRows(null); setResult(null); setFileName(null); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          <Button type="button" variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="size-4 mr-2" /> Download Excel template
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="file">Upload .xlsx or .csv</Label>
            <input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {fileName && rows && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <FileSpreadsheet className="size-3" /> {fileName} — {rows.length} rows ready
              </div>
            )}
          </div>

          {result && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div>✅ Imported: <strong>{result.ok}</strong></div>
              {result.failed > 0 && <div>⚠️ Failed: <strong>{result.failed}</strong></div>}
              {result.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Show errors</summary>
                  <ul className="mt-1 text-xs list-disc list-inside max-h-40 overflow-auto">
                    {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={runImport} disabled={busy || !rows?.length}>
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            Import {rows?.length ? `${rows.length} rows` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
