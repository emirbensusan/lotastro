import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TestTube2, Download, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TestResult {
  preprocessing: {
    originalLineCount: number;
    normalizedText: string;
    detectedSections: string[];
  };
  extraction: {
    totalLines: number;
    byIntent: Record<string, number>;
    byStatus: Record<string, number>;
    averageConfidence: number;
    needsLLM: number;
    llmPercentage: number;
  };
  rows: Array<{
    lineNumber: number;
    sourceRow: string;
    intentType?: string;
    quality?: string;
    color?: string;
    meters?: number;
    quantityUnit?: string;
    isFirmOrder?: boolean;
    isSample?: boolean;
    isOptionOrBlocked?: boolean;
    customerName?: string;
    referenceNumbers?: string;
    confidenceScore?: number;
    extractionStatus: string;
    resolutionSource?: string;
    deliveryNotes?: string;
  }>;
  dbContext?: {
    qualityCount: number;
    colorCount: number;
  };
}

const ExtractionTest = () => {
  const [inputText, setInputText] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const handleTest = async () => {
    if (!inputText.trim()) {
      toast.error("Please enter some text to test");
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-extraction', {
        body: { text: inputText }
      });

      if (error) throw error;

      setResult(data);
      toast.success("Extraction test completed");
    } catch (error: any) {
      console.error('Test error:', error);
      toast.error('Test failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleExportJSON = () => {
    if (!result) return;
    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extraction-test-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleRowExpanded = (lineNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(lineNumber)) {
      newExpanded.delete(lineNumber);
    } else {
      newExpanded.add(lineNumber);
    }
    setExpandedRows(newExpanded);
  };

  const getIntentBadge = (intent?: string) => {
    const colors: Record<string, string> = {
      order: 'bg-green-500',
      sample_request: 'bg-blue-500',
      stock_inquiry: 'bg-yellow-500',
      reservation: 'bg-purple-500',
      update: 'bg-orange-500',
      approval: 'bg-teal-500',
      shipping: 'bg-cyan-500',
      price_request: 'bg-pink-500',
      noise: 'bg-gray-400',
    };
    return (
      <Badge className={colors[intent || 'noise'] || 'bg-gray-400'}>
        {intent || 'unknown'}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ok: 'bg-success',
      needs_review: 'bg-warning',
      missing: 'bg-destructive',
    };
    return <Badge className={colors[status] || ''}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5" />
            AI Order Extraction Tester
          </CardTitle>
          <CardDescription>
            Test the extraction pipeline without saving to database. Paste sample orders below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste sample order text here...&#10;Example:&#10;753074 E123 1160MT&#10;V710 AUBERGINE 130402 STOK VARMI&#10;VARSA P777 PLUM 376 A4"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleTest} disabled={testing || !inputText.trim()}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube2 className="h-4 w-4 mr-2" />}
              Test Extraction
            </Button>
            {result && (
              <Button onClick={handleExportJSON} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Extraction Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{result.extraction.totalLines}</div>
                  <div className="text-sm text-muted-foreground">Total Lines</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{result.extraction.averageConfidence.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Avg Confidence</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{result.extraction.needsLLM}</div>
                  <div className="text-sm text-muted-foreground">Needs LLM ({result.extraction.llmPercentage}%)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{result.dbContext?.qualityCount || 0}</div>
                  <div className="text-sm text-muted-foreground">DB Qualities</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">By Intent Type:</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.extraction.byIntent).map(([intent, count]) => (
                    <div key={intent} className="flex items-center gap-2">
                      {getIntentBadge(intent)}
                      <span className="text-sm">×{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">By Status:</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.extraction.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2">
                      {getStatusBadge(status)}
                      <span className="text-sm">×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extracted Lines</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-20">Intent</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="w-24">Meters</TableHead>
                    <TableHead className="w-24">Confidence</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <>
                      <TableRow key={row.lineNumber} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpanded(row.lineNumber)}>
                        <TableCell className="font-mono text-xs">{row.lineNumber}</TableCell>
                        <TableCell>{getIntentBadge(row.intentType)}</TableCell>
                        <TableCell className="font-mono text-sm">{row.quality || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{row.color || '-'}</TableCell>
                        <TableCell className="text-right">{row.meters ? `${row.meters} ${row.quantityUnit || 'MT'}` : '-'}</TableCell>
                        <TableCell className="text-right">{row.confidenceScore ? (row.confidenceScore * 100).toFixed(0) + '%' : '-'}</TableCell>
                        <TableCell>{getStatusBadge(row.extractionStatus)}</TableCell>
                        <TableCell>
                          {expandedRows.has(row.lineNumber) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(row.lineNumber) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4 space-y-2 text-sm">
                              <div><strong>Source:</strong> <span className="font-mono">{row.sourceRow}</span></div>
                              {row.customerName && <div><strong>Customer:</strong> {row.customerName}</div>}
                              {row.referenceNumbers && <div><strong>References:</strong> {row.referenceNumbers}</div>}
                              {row.deliveryNotes && <div><strong>Delivery:</strong> {row.deliveryNotes}</div>}
                              <div className="flex gap-2">
                                {row.isFirmOrder && <Badge variant="outline">Firm Order</Badge>}
                                {row.isSample && <Badge variant="outline">Sample</Badge>}
                                {row.isOptionOrBlocked && <Badge variant="outline">Reserved/Blocked</Badge>}
                              </div>
                              {row.resolutionSource && <div className="text-xs text-muted-foreground">Resolved by: {row.resolutionSource}</div>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExtractionTest;
