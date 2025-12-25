import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { sanitizeEmailHtml } from '@/lib/sanitize';

interface VariableMeta {
  name: string;
  description: string;
  example: string;
  required: boolean;
}

interface EmailTemplatePreviewProps {
  subjectEn: string;
  subjectTr: string;
  bodyEn: string;
  bodyTr: string;
  variables: VariableMeta[];
}

const EmailTemplatePreview: React.FC<EmailTemplatePreviewProps> = ({
  subjectEn,
  subjectTr,
  bodyEn,
  bodyTr,
  variables
}) => {
  const replaceVariables = (text: string) => {
    let result = text;
    variables.forEach(v => {
      const pattern = new RegExp(`\\{${v.name}\\}`, 'g');
      result = result.replace(pattern, `<span class="bg-primary/20 px-1 rounded">${v.example}</span>`);
    });
    return sanitizeEmailHtml(result);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Email Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="en">
          <TabsList className="mb-4">
            <TabsTrigger value="en">🇺🇸 English</TabsTrigger>
            <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
          </TabsList>
          
          <TabsContent value="en">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>From:</span>
                  <span className="text-foreground">LotAstro &lt;notifications@lotastro.com&gt;</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>To:</span>
                  <span className="text-foreground">recipient@example.com</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Subject:</span>
                  <span 
                    className="font-medium"
                    dangerouslySetInnerHTML={{ __html: replaceVariables(subjectEn) }}
                  />
                </div>
              </div>
              <div className="p-4 bg-background">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: replaceVariables(bodyEn) }}
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="tr">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>Kimden:</span>
                  <span className="text-foreground">LotAstro &lt;bildirimler@lotastro.com&gt;</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>Kime:</span>
                  <span className="text-foreground">alici@ornek.com</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Konu:</span>
                  <span 
                    className="font-medium"
                    dangerouslySetInnerHTML={{ __html: replaceVariables(subjectTr) }}
                  />
                </div>
              </div>
              <div className="p-4 bg-background">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: replaceVariables(bodyTr) }}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <Separator className="my-4" />
        
        <div>
          <p className="text-xs text-muted-foreground mb-2">Variables used in preview:</p>
          <div className="flex flex-wrap gap-1">
            {variables.map(v => (
              <Badge key={v.name} variant="outline" className="text-xs">
                {v.name}: {v.example}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailTemplatePreview;