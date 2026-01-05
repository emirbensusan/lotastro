import { useEffect, useState } from 'react';
import { X, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { helpContent, getHelpTitle } from './helpContent';

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic?: string;
}

export function HelpPanel({ open, onOpenChange, topic: initialTopic }: HelpPanelProps) {
  const { language } = useLanguage();
  const [currentTopic, setCurrentTopic] = useState(initialTopic || 'lot-intake');

  useEffect(() => {
    if (initialTopic) {
      setCurrentTopic(initialTopic);
    }
  }, [initialTopic]);

  useEffect(() => {
    const handleOpenHelp = (event: CustomEvent<{ topic: string }>) => {
      setCurrentTopic(event.detail.topic);
      onOpenChange(true);
    };

    window.addEventListener('open-help', handleOpenHelp as EventListener);
    return () => {
      window.removeEventListener('open-help', handleOpenHelp as EventListener);
    };
  }, [onOpenChange]);

  const content = helpContent[currentTopic];
  const isEnglish = language === 'en';

  if (!content) {
    return null;
  }

  const title = isEnglish ? content.titleEn : content.titleTr;
  const overview = isEnglish ? content.overviewEn : content.overviewTr;
  const steps = isEnglish ? content.stepsEn : content.stepsTr;
  const tips = isEnglish ? content.tipsEn : content.tipsTr;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]" data-owner="help-panel">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          {/* Overview */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {isEnglish ? 'Overview' : 'Genel Bakış'}
            </h3>
            <p className="text-sm leading-relaxed">{overview}</p>
          </div>

          {/* Steps */}
          {steps && steps.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {isEnglish ? 'How to' : 'Nasıl Yapılır'}
                </h3>
                <ol className="space-y-2">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {/* Tips */}
          {tips && tips.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {isEnglish ? 'Tips' : 'İpuçları'}
                </h3>
                <ul className="space-y-2">
                  {tips.map((tip, index) => (
                    <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-primary">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Related Topics */}
          {content.relatedTopics && content.relatedTopics.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {isEnglish ? 'Related Topics' : 'İlgili Konular'}
                </h3>
                <div className="space-y-1">
                  {content.relatedTopics.map((topicId) => (
                    <Button
                      key={topicId}
                      variant="ghost"
                      className="w-full justify-between h-9 px-2"
                      onClick={() => setCurrentTopic(topicId)}
                    >
                      <span className="text-sm">{getHelpTitle(topicId, language as 'en' | 'tr')}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Documentation Link */}
          {content.docsUrl && (
            <>
              <Separator className="my-4" />
              <Button variant="outline" className="w-full" asChild>
                <a href={content.docsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {isEnglish ? 'View Full Documentation' : 'Tam Dokümantasyonu Görüntüle'}
                </a>
              </Button>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
