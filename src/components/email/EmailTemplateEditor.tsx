import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Bold, Italic, Link as LinkIcon, List, ListOrdered, Heading2, 
  Code, Undo, Redo, AlertCircle, RotateCcw, Eye, Send, History 
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface VariableMeta {
  name: string;
  description: string;
  example: string;
  required: boolean;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  category: string;
  subject_en: string;
  subject_tr: string;
  body_en: string;
  body_tr: string;
  default_subject_en: string | null;
  default_subject_tr: string | null;
  default_body_en: string | null;
  default_body_tr: string | null;
  variables: string[];
  variables_meta: VariableMeta[];
  is_active: boolean;
  is_system: boolean;
  version: number;
}

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  onSave: () => void;
  onSendTest: () => void;
  onReset: () => void;
  onViewHistory: () => void;
  saving: boolean;
  sendingTest: boolean;
  hasChanges: boolean;
}

const SUBJECT_MAX_LENGTH = 60;
const CATEGORIES = [
  { value: 'manufacturing_orders', label: 'Manufacturing Orders' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'system', label: 'System Alerts' },
];

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template,
  onChange,
  onSave,
  onSendTest,
  onReset,
  onViewHistory,
  saving,
  sendingTest,
  hasChanges
}) => {
  const { t } = useLanguage();
  const [htmlMode, setHtmlMode] = useState(false);
  const [previewLang, setPreviewLang] = useState<'en' | 'tr'>('en');
  const [showPreview, setShowPreview] = useState(false);
  const subjectEnRef = useRef<HTMLInputElement>(null);
  const subjectTrRef = useRef<HTMLInputElement>(null);
  
  // Validation states
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // TipTap editors for EN and TR
  const editorEn = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Enter email body content...' }),
    ],
    content: template.body_en,
    onUpdate: ({ editor }) => {
      onChange({ ...template, body_en: editor.getHTML() });
    },
  });

  const editorTr = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'E-posta içeriğini girin...' }),
    ],
    content: template.body_tr,
    onUpdate: ({ editor }) => {
      onChange({ ...template, body_tr: editor.getHTML() });
    },
  });

  // Update editors when template changes externally
  useEffect(() => {
    if (editorEn && template.body_en !== editorEn.getHTML()) {
      editorEn.commands.setContent(template.body_en);
    }
    if (editorTr && template.body_tr !== editorTr.getHTML()) {
      editorTr.commands.setContent(template.body_tr);
    }
  }, [template.id]);

  // Validate template
  useEffect(() => {
    const errors: string[] = [];
    
    if (!template.subject_en.trim()) errors.push('English subject is required');
    if (!template.subject_tr.trim()) errors.push('Turkish subject is required');
    if (!template.body_en.trim() || template.body_en === '<p></p>') errors.push('English body is required');
    if (!template.body_tr.trim() || template.body_tr === '<p></p>') errors.push('Turkish body is required');
    
    // Check for required variables
    const requiredVars = template.variables_meta?.filter(v => v.required) || [];
    requiredVars.forEach(v => {
      const varPattern = `{${v.name}}`;
      if (!template.body_en.includes(varPattern) && !template.subject_en.includes(varPattern)) {
        errors.push(`Required variable {${v.name}} is missing from English template`);
      }
      if (!template.body_tr.includes(varPattern) && !template.subject_tr.includes(varPattern)) {
        errors.push(`Required variable {${v.name}} is missing from Turkish template`);
      }
    });
    
    // Basic HTML validation
    const checkHtml = (html: string, lang: string) => {
      const openTags = (html.match(/<[a-z]+[^>]*>/gi) || []).length;
      const closeTags = (html.match(/<\/[a-z]+>/gi) || []).length;
      if (Math.abs(openTags - closeTags) > 2) {
        errors.push(`${lang} body may have unclosed HTML tags`);
      }
    };
    checkHtml(template.body_en, 'English');
    checkHtml(template.body_tr, 'Turkish');
    
    setValidationErrors(errors);
  }, [template]);

  const insertVariable = useCallback((varName: string, target: 'subject_en' | 'subject_tr' | 'body_en' | 'body_tr') => {
    const insertText = `{${varName}}`;
    
    if (target === 'subject_en' && subjectEnRef.current) {
      const input = subjectEnRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = template.subject_en.slice(0, start) + insertText + template.subject_en.slice(end);
      onChange({ ...template, subject_en: newValue });
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + insertText.length, start + insertText.length);
      }, 0);
    } else if (target === 'subject_tr' && subjectTrRef.current) {
      const input = subjectTrRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = template.subject_tr.slice(0, start) + insertText + template.subject_tr.slice(end);
      onChange({ ...template, subject_tr: newValue });
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + insertText.length, start + insertText.length);
      }, 0);
    } else if (target === 'body_en' && editorEn) {
      editorEn.chain().focus().insertContent(insertText).run();
    } else if (target === 'body_tr' && editorTr) {
      editorTr.chain().focus().insertContent(insertText).run();
    }
  }, [template, onChange, editorEn, editorTr]);

  const getSubjectLengthColor = (length: number) => {
    if (length <= SUBJECT_MAX_LENGTH - 10) return 'text-muted-foreground';
    if (length <= SUBJECT_MAX_LENGTH) return 'text-yellow-600';
    return 'text-destructive';
  };

  const renderPreview = (lang: 'en' | 'tr') => {
    let subject = lang === 'en' ? template.subject_en : template.subject_tr;
    let body = lang === 'en' ? template.body_en : template.body_tr;
    
    // Replace variables with example values
    template.variables_meta?.forEach(v => {
      const pattern = new RegExp(`\\{${v.name}\\}`, 'g');
      subject = subject.replace(pattern, v.example);
      body = body.replace(pattern, v.example);
    });
    
    return { subject, body };
  };

  const EditorToolbar = ({ editor }: { editor: any }) => {
    if (!editor) return null;
    
    return (
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(editor.isActive('bold') && 'bg-muted')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(editor.isActive('italic') && 'bg-muted')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(editor.isActive('heading', { level: 2 }) && 'bg-muted')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(editor.isActive('bulletList') && 'bg-muted')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(editor.isActive('orderedList') && 'bg-muted')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </Button>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHtmlMode(!htmlMode)}
            className={cn(htmlMode && 'bg-muted')}
          >
            <Code className="h-4 w-4 mr-1" />
            HTML
          </Button>
        </div>
      </div>
    );
  };

  const preview = showPreview ? renderPreview(previewLang) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header with template info */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div>
            <Input
              value={template.name}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
              className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
              placeholder="Template Name"
            />
            <code className="text-xs text-muted-foreground">{template.template_key}</code>
          </div>
          {template.is_system && (
            <Badge variant="secondary">System</Badge>
          )}
          {!template.is_active && (
            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Label htmlFor="active-switch" className="text-sm">Active</Label>
            <Switch
              id="active-switch"
              checked={template.is_active}
              onCheckedChange={(checked) => onChange({ ...template, is_active: checked })}
            />
          </div>
          <Button variant="outline" size="sm" onClick={onViewHistory}>
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          {template.default_body_en && (
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={onSendTest} disabled={sendingTest}>
            <Send className="h-4 w-4 mr-1" />
            {sendingTest ? 'Sending...' : 'Test'}
          </Button>
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="space-y-1">
              {validationErrors.map((error, i) => (
                <p key={i} className="text-sm text-destructive">{error}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* English column */}
        <div className="flex flex-col border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
            <span className="text-lg">🇺🇸</span>
            <span className="font-medium">English</span>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-auto">
            {/* Subject */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Subject</Label>
                <span className={cn("text-xs", getSubjectLengthColor(template.subject_en.length))}>
                  {template.subject_en.length}/{SUBJECT_MAX_LENGTH}
                </span>
              </div>
              <Input
                ref={subjectEnRef}
                value={template.subject_en}
                onChange={(e) => onChange({ ...template, subject_en: e.target.value })}
                placeholder="Enter subject line..."
              />
            </div>
            
            {/* Body */}
            <div className="space-y-2 flex-1">
              <Label>Body</Label>
              {htmlMode ? (
                <Textarea
                  value={template.body_en}
                  onChange={(e) => onChange({ ...template, body_en: e.target.value })}
                  className="font-mono text-sm min-h-[300px]"
                />
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <EditorToolbar editor={editorEn} />
                  <EditorContent 
                    editor={editorEn} 
                    className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Turkish column */}
        <div className="flex flex-col border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
            <span className="text-lg">🇹🇷</span>
            <span className="font-medium">Türkçe</span>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-auto">
            {/* Subject */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Konu</Label>
                <span className={cn("text-xs", getSubjectLengthColor(template.subject_tr.length))}>
                  {template.subject_tr.length}/{SUBJECT_MAX_LENGTH}
                </span>
              </div>
              <Input
                ref={subjectTrRef}
                value={template.subject_tr}
                onChange={(e) => onChange({ ...template, subject_tr: e.target.value })}
                placeholder="Konu satırını girin..."
              />
            </div>
            
            {/* Body */}
            <div className="space-y-2 flex-1">
              <Label>İçerik</Label>
              {htmlMode ? (
                <Textarea
                  value={template.body_tr}
                  onChange={(e) => onChange({ ...template, body_tr: e.target.value })}
                  className="font-mono text-sm min-h-[300px]"
                />
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <EditorToolbar editor={editorTr} />
                  <EditorContent 
                    editor={editorTr} 
                    className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Variables panel */}
      <div className="mt-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Available Variables</Label>
          <span className="text-xs text-muted-foreground">Click to insert at cursor</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            {template.variables_meta?.map((v) => (
              <Tooltip key={v.name}>
                <TooltipTrigger asChild>
                  <Badge
                    variant={v.required ? "default" : "secondary"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => {
                      // Insert into the last focused field or default to body_en
                      const activeElement = document.activeElement;
                      if (activeElement === subjectEnRef.current) {
                        insertVariable(v.name, 'subject_en');
                      } else if (activeElement === subjectTrRef.current) {
                        insertVariable(v.name, 'subject_tr');
                      } else if (editorTr?.isFocused) {
                        insertVariable(v.name, 'body_tr');
                      } else {
                        insertVariable(v.name, 'body_en');
                      }
                    }}
                  >
                    {`{${v.name}}`}
                    {v.required && <span className="ml-1 text-destructive-foreground">*</span>}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-medium">{v.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Example: {v.example}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* Preview panel */}
      {showPreview && preview && (
        <div className="mt-4 border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
            <span className="font-medium">Preview</span>
            <Tabs value={previewLang} onValueChange={(v) => setPreviewLang(v as 'en' | 'tr')} className="h-auto">
              <TabsList className="h-8">
                <TabsTrigger value="en" className="text-xs">🇺🇸 EN</TabsTrigger>
                <TabsTrigger value="tr" className="text-xs">🇹🇷 TR</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="p-4 bg-background">
            <div className="mb-2">
              <Label className="text-xs text-muted-foreground">Subject:</Label>
              <p className="font-medium">{preview.subject}</p>
            </div>
            <Separator className="my-3" />
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: preview.body }}
            />
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Version {template.version}
          {hasChanges && <span className="ml-2 text-yellow-600">• Unsaved changes</span>}
        </div>
        <Button onClick={onSave} disabled={saving || validationErrors.length > 0}>
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>
  );
};

export default EmailTemplateEditor;