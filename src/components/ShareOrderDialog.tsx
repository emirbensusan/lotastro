import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Loader2, Share2, X, Calendar } from 'lucide-react';

interface ShareOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onShareComplete?: () => void;
}

interface UserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface ShareRecord {
  id: string;
  shared_with_user_id: string;
  expires_at: string | null;
  created_at: string;
  profile?: UserProfile;
}

const ShareOrderDialog: React.FC<ShareOrderDialogProps> = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onShareComplete,
}) => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existingShares, setExistingShares] = useState<ShareRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [expiresInDays, setExpiresInDays] = useState<string>('7');
  const [loading, setLoading] = useState(false);
  const [sharesLoading, setSharesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchExistingShares();
    }
  }, [open, orderId]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, role')
        .eq('active', true)
        .neq('user_id', profile?.user_id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchExistingShares = async () => {
    setSharesLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_shares')
        .select('id, shared_with_user_id, expires_at, created_at')
        .eq('order_id', orderId);

      if (error) throw error;

      // Fetch profile info for each shared user
      const sharesWithProfiles: ShareRecord[] = [];
      for (const share of data || []) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, email, full_name, role')
          .eq('user_id', share.shared_with_user_id)
          .single();

        sharesWithProfiles.push({
          ...share,
          profile: profileData || undefined,
        });
      }

      setExistingShares(sharesWithProfiles);
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setSharesLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedUserId) {
      toast.error(t('selectUserToShare') || 'Please select a user to share with');
      return;
    }

    setLoading(true);
    try {
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('order_shares')
        .insert({
          order_id: orderId,
          shared_with_user_id: selectedUserId,
          shared_by_user_id: profile?.user_id,
          expires_at: expiresAt,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error(t('alreadySharedWithUser') || 'Order is already shared with this user');
        } else {
          throw error;
        }
        return;
      }

      toast.success(t('orderSharedSuccessfully') || 'Order shared successfully');
      setSelectedUserId('');
      fetchExistingShares();
      onShareComplete?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to share order');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('order_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      toast.success(t('shareRemoved') || 'Share removed');
      fetchExistingShares();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove share');
    }
  };

  const availableUsers = users.filter(
    (user) => !existingShares.some((share) => share.shared_with_user_id === user.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t('shareOrder') || 'Share Order'}
          </DialogTitle>
          <DialogDescription>
            {t('shareOrderDescription') || 'Share order'} {orderNumber} {t('withTeamMembers') || 'with team members'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Shares */}
          {existingShares.length > 0 && (
            <div className="space-y-2">
              <Label>{t('sharedWith') || 'Shared with'}</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {existingShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {share.profile?.full_name || share.profile?.email || 'Unknown User'}
                      </span>
                      {share.expires_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t('expiresOn') || 'Expires'}: {new Date(share.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveShare(share.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Share */}
          <div className="space-y-2">
            <Label>{t('shareWithUser') || 'Share with user'}</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectUser') || 'Select user...'} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{user.full_name || user.email}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
                {availableUsers.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    {t('noUsersAvailable') || 'No users available to share with'}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('expiresIn') || 'Expires in (days)'}</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 {t('day') || 'day'}</SelectItem>
                <SelectItem value="7">7 {t('days') || 'days'}</SelectItem>
                <SelectItem value="30">30 {t('days') || 'days'}</SelectItem>
                <SelectItem value="90">90 {t('days') || 'days'}</SelectItem>
                <SelectItem value="">{t('never') || 'Never'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close') || 'Close'}
          </Button>
          <Button onClick={handleShare} disabled={loading || !selectedUserId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('share') || 'Share'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareOrderDialog;
