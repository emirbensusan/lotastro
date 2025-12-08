import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface SendTestEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
}

const SendTestEmailDialog: React.FC<SendTestEmailDialogProps> = ({
  open,
  onOpenChange,
  templateId,
  templateName
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<'en' | 'tr'>('en');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const handleSend = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter a recipient email address',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          templateId,
          recipientEmail: email.trim(),
          language
        }
      });

      if (error) throw error;

      if (data?.success) {
        setResult('success');
        toast({
          title: 'Test email sent',
          description: `Email sent to ${email}`,
        });
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      setResult('error');
      toast({
        title: 'Failed to send',
        description: error.message || 'Could not send test email',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setEmail('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Email
          </DialogTitle>
          <DialogDescription>
            Send a test email using the "{templateName}" template with sample data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Email</Label>
            <Input
              id="recipient"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <RadioGroup 
              value={language} 
              onValueChange={(v) => setLanguage(v as 'en' | 'tr')}
              className="flex gap-4"
              disabled={sending}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="lang-en" />
                <Label htmlFor="lang-en" className="font-normal cursor-pointer">
                  🇺🇸 English
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tr" id="lang-tr" />
                <Label htmlFor="lang-tr" className="font-normal cursor-pointer">
                  🇹🇷 Türkçe
                </Label>
              </div>
            </RadioGroup>
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-md ${
              result === 'success' 
                ? 'bg-green-500/10 text-green-600' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {result === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Test email sent successfully!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Failed to send test email</span>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !email.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendTestEmailDialog;