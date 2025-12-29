import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, Database, Shield, Edit, Trash2, UserCheck, Key, Loader2, Mail, UserX, Copy, RefreshCw, AlertCircle, CheckCircle2, ArrowRightLeft, Package, Link2, Webhook, BarChart3, Code } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import InteractivePermissionsTab from '@/components/InteractivePermissionsTab';
import EmailTemplatesTab from '@/components/EmailTemplatesTab';
import ReminderSettingsTab from '@/components/ReminderSettingsTab';
import OrderFlowSettingsTab from '@/components/OrderFlowSettingsTab';
import CatalogCustomFieldsAdmin from '@/components/catalog/CatalogCustomFieldsAdmin';
import CatalogApprovalSettings from '@/components/catalog/CatalogApprovalSettings';
import IPWhitelistTab from '@/components/IPWhitelistTab';
import AuditRetentionSettings from '@/components/AuditRetentionSettings';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MigrationProgressDialog from '@/components/MigrationProgressDialog';
import StockTakeSettingsTab from '@/components/stocktake/StockTakeSettingsTab';
import ApiKeyManagementTab from '@/components/admin/ApiKeyManagementTab';
import WebhookSubscriptionsTab from '@/components/admin/WebhookSubscriptionsTab';
import ApiUsageDashboardTab from '@/components/admin/ApiUsageDashboardTab';
import ApiOverviewTab from '@/components/admin/ApiOverviewTab';
import SessionSettingsTab from '@/components/admin/SessionSettingsTab';
import PasswordPolicyTab from '@/components/admin/PasswordPolicyTab';
import MFASettings from '@/components/auth/MFASettings';
import MFAEnrollmentBanner from '@/components/auth/MFAEnrollmentBanner';

type UserRole = 'admin' | 'warehouse_staff' | 'accounting' | 'senior_manager';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  active?: boolean;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  invited_at: string;
  expires_at: string;
  email_sent?: boolean;
  email_error?: string;
  invite_link?: string;
  last_attempt_at?: string;
}

const Admin: React.FC = () => {
  const { profile, hasRole, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState('users');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<Profile | null>(null);
  const [conflictDetails, setConflictDetails] = useState<string>('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [userToChangePassword, setUserToChangePassword] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('warehouse_staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLinkDialog, setInviteLinkDialog] = useState(false);
  const [currentInviteLink, setCurrentInviteLink] = useState('');
  const [reconcilingUsers, setReconcilingUsers] = useState(false);
  const [forceDeleteDialog, setForceDeleteDialog] = useState(false);
  const [deleteDependencies, setDeleteDependencies] = useState<any[]>([]);
  
  // Catalog migration state
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationPreviewLoading, setMigrationPreviewLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [migrationProgressOpen, setMigrationProgressOpen] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({
    isRunning: false,
    currentStep: '',
    processedItems: 0,
    totalItems: 0,
    errors: [] as string[],
    result: undefined as any,
  });
  
  // Catalog settings dialogs
  const [customFieldsDialogOpen, setCustomFieldsDialogOpen] = useState(false);
  const [approvalSettingsOpen, setApprovalSettingsOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      fetchProfiles();
      fetchPendingInvitations();
    }
  }, [authLoading]);

  const fetchProfiles = async () => {
    setLoading(true);
    
    if (!hasRole('admin')) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: t('error') as string,
        description: t('errorFetchingProfiles') as string,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingInvitations = async () => {
    setInvitationsLoading(true);
    
    if (!hasRole('admin')) {
      setInvitationsLoading(false);
      return;
    }
    
    try {
      // Get pending invitations
      const { data: invitations, error: invitationsError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (invitationsError) throw invitationsError;

      // Get all profiles to check which invitations have been accepted
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('email');

      if (profilesError) throw profilesError;

      // Filter out invitations where user already has a profile
      const profileEmails = new Set(profiles?.map(p => p.email) || []);
      const pendingOnly = invitations?.filter(inv => !profileEmails.has(inv.email)) || [];

      setPendingInvitations(pendingOnly);
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      toast({
        title: t('error') as string,
        description: 'Failed to fetch pending invitations',
        variant: 'destructive'
      });
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleDeleteInvitation = async (invitationId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: `Invitation for ${email} has been deleted`,
      });

      fetchPendingInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({
        title: t('error') as string,
        description: 'Failed to delete invitation',
        variant: 'destructive'
      });
    }
  };

  const updateProfile = async (profileId: string, updates: { full_name?: string; role?: UserRole }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: t('success') as string,
        description: t('profileUpdatedSuccessfully') as string
      });
      
      fetchProfiles();
      setEditingProfile(null);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('error') as string,
        description: t('failedToUpdateProfile') as string,
        variant: 'destructive'
      });
    }
  };

  const deleteProfile = async (profile: Profile, force = false) => {
    try {
      // Use edge function for secure admin deletion
      const { data, error: deleteError } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: profile.user_id, force }
      });
      
      if (deleteError) {
        // Check if it's a conflict error (user has dependencies)
        if (deleteError.status === 409) {
          const errorData = typeof deleteError.details === 'string' 
            ? JSON.parse(deleteError.details) 
            : deleteError.details;
          
          setConflictDetails(errorData.details || 'User has associated records');
          setUserToDeactivate(profile);
          setDeleteDialogOpen(false);
          setUserToDelete(null);
          setDeactivateDialogOpen(true);
          return;
        }
        throw deleteError;
      }

      toast({
        title: t('success') as string,
        description: (t('userDeletedSuccessfully') as string).replace('{name}', profile.full_name || profile.email)
      });
      
      fetchProfiles();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeactivateDialogOpen(false);
      setUserToDeactivate(null);
      setConflictDetails('');
    } catch (error: any) {
      console.error('Error deleting profile:', error);
      toast({
        title: t('error') as string,
        description: error?.message || t('failedToDeleteUser') as string,
        variant: 'destructive'
      });
    }
  };

  const deactivateProfile = async (profile: Profile) => {
    try {
      const { error: deactivateError } = await supabase.functions.invoke('admin-deactivate-user', {
        body: { userId: profile.user_id }
      });
      
      if (deactivateError) throw deactivateError;

      toast({
        title: t('success') as string,
        description: `User ${profile.full_name || profile.email} has been deactivated`
      });
      
      fetchProfiles();
      setDeactivateDialogOpen(false);
      setUserToDeactivate(null);
      setConflictDetails('');
    } catch (error: any) {
      console.error('Error deactivating profile:', error);
      toast({
        title: t('error') as string,
        description: error?.message || 'Failed to deactivate user',
        variant: 'destructive'
      });
    }
  };

  const changePassword = async (profile: Profile) => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('error') as string,
        description: t('passwordsDoNotMatch') as string,
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: t('error') as string,
        description: 'Password must be at least 8 characters long',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-change-password', {
        body: { 
          userId: profile.user_id,
          newPassword: newPassword
        }
      });
      
      if (error) {
        let errorMessage = t('failedToChangePassword') as string;
        
        // Handle specific error messages from the edge function
        if (error.message) {
          if (error.message.includes('weak') || error.message.includes('commonly used')) {
            errorMessage = t('passwordTooWeak') as string;
          } else if (error.message.includes('pwned') || error.message.includes('data breaches')) {
            errorMessage = t('passwordCompromised') as string;
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: t('error') as string,
          description: errorMessage,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success') as string,
        description: t('passwordChangedSuccessfully') as string
      });
      
      setPasswordDialogOpen(false);
      setUserToChangePassword(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: t('error') as string,
        description: error?.message || t('failedToChangePassword') as string,
        variant: 'destructive'
      });
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return t('roleAdmin');
      case 'senior_manager': return t('roleSeniorManager');
      case 'accounting': return t('roleAccounting');
      case 'warehouse_staff': return t('roleWarehouseStaff');
      default: return role.replace('_', ' ').toUpperCase();
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'senior_manager': return 'default';
      case 'accounting': return 'secondary';
      case 'warehouse_staff': return 'outline';
      default: return 'outline';
    }
  };

  const handleSendInvitation = async () => {
    // Client-side validation
    if (!inviteEmail || !inviteRole) {
      toast({
        title: 'Validation Error',
        description: 'Please provide email and role',
        variant: 'destructive'
      });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }

    // Check if email already exists in profiles list
    const emailExists = profiles.some(p => p.email.toLowerCase() === inviteEmail.toLowerCase());
    if (emailExists) {
      toast({
        title: 'User Already Exists',
        description: 'This email is already registered. Edit the existing user instead.',
        variant: 'destructive'
      });
      return;
    }

    setInviteLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: inviteEmail,
          role: inviteRole
        }
      });

      if (error) throw error;

      // Check response structure
      const responseData = data as any;

      // Handle email sending failure but still show invite link
      if (responseData?.invite_link && responseData?.email_sent === false) {
        setCurrentInviteLink(responseData.invite_link);
        setInviteLinkDialog(true);
        
        toast({
          title: 'Email Failed',
          description: responseData.error || 'Email delivery failed, but invitation created. Use the link to share manually.',
          variant: 'destructive'
        });
      } else if (responseData?.success) {
        // Success - email sent
        toast({
          title: 'Success',
          description: 'Invitation sent successfully via email'
        });

        // Show invite link for manual sharing if available
        if (responseData.invite_link) {
          setCurrentInviteLink(responseData.invite_link);
        }
      }

      setInviteEmail('');
      setInviteRole('warehouse_staff');
      fetchPendingInvitations();
      fetchProfiles(); // Refresh profiles as well
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      
      // Parse structured error from edge function
      let errorTitle = 'Error';
      let errorMessage = 'Failed to send invitation';
      
      if (error.message) {
        const errorData = typeof error.message === 'string' ? 
          (error.message.includes('{') ? JSON.parse(error.message) : { details: error.message }) : 
          error.message;

        if (errorData.code === 'USER_EXISTS') {
          errorTitle = 'User Already Exists';
          errorMessage = 'This email is already registered. Use password reset or edit the existing user instead.';
        } else if (errorData.code === 'AUTH_ONLY_USER') {
          errorTitle = 'Ghost User Detected';
          errorMessage = 'This email exists in authentication but has no profile. Click "Reconcile Users" to fix this issue.';
        } else if (errorData.code === 'RATE_LIMIT') {
          errorTitle = 'Rate Limit Exceeded';
          errorMessage = 'Too many invitations sent. Please wait a few minutes before trying again.';
        } else if (errorData.code === 'EMAIL_DELIVERY') {
          errorTitle = 'Email Delivery Failed';
          errorMessage = 'Unable to send invitation email. The link is available to share manually.';
          
          // Show invite link if available
          if (errorData.invite_link) {
            setCurrentInviteLink(errorData.invite_link);
            setInviteLinkDialog(true);
          }
        } else if (errorData.code === 'INVALID_EMAIL') {
          errorTitle = 'Invalid Email';
          errorMessage = 'Please enter a valid email address.';
        } else {
          errorMessage = errorData.details || errorData.error || error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 6000
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleReconcileUsers = async () => {
    setReconcilingUsers(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-reconcile-users');

      if (error) throw error;

      const result = data as any;

      toast({
        title: 'Reconciliation Complete',
        description: result.message || `${result.createdProfiles} profiles created, ${result.reactivatedProfiles} reactivated`,
        duration: 5000
      });

      // Refresh profiles
      fetchProfiles();
      fetchPendingInvitations();
    } catch (error: any) {
      console.error('Error reconciling users:', error);
      toast({
        title: 'Reconciliation Failed',
        description: error.message || 'Failed to reconcile users',
        variant: 'destructive'
      });
    } finally {
      setReconcilingUsers(false);
    }
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: invitation.email,
          role: invitation.role
        }
      });

      if (error) throw error;

      toast({
        title: 'Invitation Resent',
        description: `Invitation resent to ${invitation.email}`
      });

      fetchPendingInvitations();
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Resend Failed',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Invitation link copied to clipboard'
    });
  };

  const handleMigrationPreview = async () => {
    setMigrationPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-catalog-items', {
        body: { dryRun: true }
      });

      if (error) throw error;

      setMigrationResult(data);
      setMigrationDialogOpen(true);
    } catch (error: any) {
      console.error('Migration preview error:', error);
      toast({
        title: t('error') as string,
        description: error?.message || (t('catalog.migration.migrationFailed') as string),
        variant: 'destructive'
      });
    } finally {
      setMigrationPreviewLoading(false);
    }
  };

  const handleMigrationRun = async () => {
    // Open progress dialog immediately
    setMigrationProgressOpen(true);
    setMigrationProgress({
      isRunning: true,
      currentStep: t('catalog.migration.fetchingData') as string,
      processedItems: 0,
      totalItems: 100,
      errors: [],
      result: undefined,
    });
    setMigrationLoading(true);

    // Create AbortController with 3 minute timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    try {
      // Simulate progress updates while waiting
      const progressInterval = setInterval(() => {
        setMigrationProgress(prev => ({
          ...prev,
          processedItems: Math.min(prev.processedItems + 5, 95),
          currentStep: prev.processedItems < 20 
            ? (t('catalog.migration.fetchingData') as string)
            : prev.processedItems < 50 
              ? (t('catalog.migration.creatingItems') as string)
              : prev.processedItems < 80
                ? (t('catalog.migration.linkingRecords') as string)
                : (t('catalog.migration.finalizing') as string),
        }));
      }, 2000);

      const { data, error } = await supabase.functions.invoke('migrate-catalog-items', {
        body: { dryRun: false }
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);

      if (error) throw error;

      setMigrationResult(data);
      setMigrationProgress({
        isRunning: false,
        currentStep: '',
        processedItems: 100,
        totalItems: 100,
        errors: data?.errors || [],
        result: data,
      });
      
      toast({
        title: t('success') as string,
        description: t('catalog.migration.migrationComplete') as string,
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Migration error:', error);
      
      // Check if it's a timeout/abort error
      const isTimeout = error?.name === 'AbortError' || 
                       error?.message?.includes('timeout') ||
                       error?.message?.includes('aborted') ||
                       error?.message?.includes('Failed to send');
      
      if (isTimeout) {
        // Show "still running on server" state instead of error
        setMigrationProgress(prev => ({
          ...prev,
          isRunning: false,
          currentStep: '',
          errors: [],
          result: {
            success: true,
            dryRun: false,
            catalogItemsCreated: -1, // -1 indicates "unknown - check status"
            lotsLinked: -1,
            incomingStockLinked: -1,
            manufacturingOrdersLinked: -1,
            skippedExisting: -1,
            errors: [],
            details: { uniquePairs: -1, existingCatalogItems: -1 },
            timedOut: true,
          },
        }));
        toast({
          title: t('catalog.migration.serverProcessing') as string,
          description: t('catalog.migration.timeoutMessage') as string,
        });
      } else {
        setMigrationProgress(prev => ({
          ...prev,
          isRunning: false,
          errors: [...prev.errors, error?.message || 'Unknown error'],
          result: { success: false, error: error?.message },
        }));
        toast({
          title: t('error') as string,
          description: error?.message || (t('catalog.migration.migrationFailed') as string),
          variant: 'destructive'
        });
      }
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleCheckMigrationStatus = async () => {
    try {
      // Query current catalog items count and unlinked lots
      const [catalogResult, lotsResult, unlinkedLotsResult] = await Promise.all([
        supabase.from('catalog_items').select('id', { count: 'exact', head: true }),
        supabase.from('lots').select('id', { count: 'exact', head: true }),
        supabase.from('lots').select('id', { count: 'exact', head: true }).is('catalog_item_id', null),
      ]);
      
      const catalogCount = catalogResult.count || 0;
      const totalLots = lotsResult.count || 0;
      const unlinkedLots = unlinkedLotsResult.count || 0;
      const linkedLots = totalLots - unlinkedLots;
      
      toast({
        title: t('catalog.migration.statusCheck') as string,
        description: `${t('catalog.migration.catalogItems')}: ${catalogCount} | ${t('catalog.migration.linkedLots')}: ${linkedLots}/${totalLots} | ${t('catalog.migration.unlinkedLots')}: ${unlinkedLots}`,
      });
    } catch (error) {
      console.error('Status check error:', error);
      toast({
        title: t('error') as string,
        description: t('catalog.migration.statusCheckFailed') as string,
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (authLoading || permissionsLoading) {
    return <div className="text-sm text-muted-foreground">{t('loading')}</div>;
  }
  
  if (!hasPermission('usermanagement', 'viewusers')) {
    return <div className="text-sm text-muted-foreground">{t('notAuthorizedAccess')}</div>;
  }

  const scrollToInviteSection = () => {
    setActiveTab('users');
    setTimeout(() => {
      document.getElementById('invite-section')?.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('invite-email')?.focus();
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('settingsPanel')}</h1>
        <Button onClick={scrollToInviteSection} className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {t('inviteUser')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
          <TabsTrigger value="users" className="flex-shrink-0">{t('userManagement')}</TabsTrigger>
          <TabsTrigger value="permissions" className="flex-shrink-0">{t('permissions')}</TabsTrigger>
          <TabsTrigger value="security" className="flex-shrink-0">{t('security')}</TabsTrigger>
          <TabsTrigger value="sessionSettings" className="flex-shrink-0 flex items-center gap-1">
            <Settings className="h-3 w-3" />
            {language === 'tr' ? 'Oturum Ayarları' : 'Session Settings'}
          </TabsTrigger>
          <TabsTrigger value="passwordPolicy" className="flex-shrink-0 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {language === 'tr' ? 'Şifre Politikası' : 'Password Policy'}
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex-shrink-0">{t('catalog.settings')}</TabsTrigger>
          <TabsTrigger value="emailTemplates" className="flex-shrink-0">{t('emailSettings.emailTemplates')}</TabsTrigger>
          <TabsTrigger value="reminderSettings" className="flex-shrink-0">{t('emailSettings.reminderSettings')}</TabsTrigger>
          <TabsTrigger value="auditRetention" className="flex-shrink-0">{t('auditRetention')}</TabsTrigger>
          <TabsTrigger value="orderFlow" className="flex-shrink-0">{t('orderFlowSettings')}</TabsTrigger>
          <TabsTrigger value="stocktake" className="flex-shrink-0">{language === 'tr' ? 'Stok Sayım' : 'Stock Take'}</TabsTrigger>
          <TabsTrigger value="apiOverview" className="flex-shrink-0 flex items-center gap-1">
            <Code className="h-3 w-3" />
            {language === 'tr' ? 'API Genel Bakış' : 'API Overview'}
          </TabsTrigger>
          <TabsTrigger value="apiKeys" className="flex-shrink-0 flex items-center gap-1">
            <Key className="h-3 w-3" />
            {language === 'tr' ? 'API Anahtarları' : 'API Keys'}
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex-shrink-0 flex items-center gap-1">
            <Webhook className="h-3 w-3" />
            {language === 'tr' ? 'Webhooks' : 'Webhooks'}
          </TabsTrigger>
          <TabsTrigger value="apiUsage" className="flex-shrink-0 flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {language === 'tr' ? 'API Kullanımı' : 'API Usage'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* MFA Enforcement Banner for Admins */}
          <MFAEnrollmentBanner 
            dismissible={true}
            message="For security, administrators should enable Two-Factor Authentication (MFA). This protects your account and prevents unauthorized access to admin features."
          />
          
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('activeSystemUsers')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admins')}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.role === 'admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('administratorAccounts')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('seniorManagers')}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.role === 'senior_manager').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('seniorManagersDesc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('accounting')}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.role === 'accounting').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('accountingUsers')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('warehouseStaff')}</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.role === 'warehouse_staff').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('warehousePersonnel')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Invitations */}
      <Card id="invite-section">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Invite New Users</CardTitle>
            <CardDescription>Send invitations to new team members</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReconcileUsers}
            disabled={reconcilingUsers}
          >
            {reconcilingUsers ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconcile Users
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                    <SelectItem value="accounting">Accounting</SelectItem>
                    <SelectItem value="senior_manager">Senior Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleSendInvitation}
                  disabled={inviteLoading || !inviteEmail}
                  className="w-full"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Users who have been invited but haven't accepted yet</CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : pendingInvitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending invitations
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email Status</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role)}>
                        {getRoleDisplayName(invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {invitation.email_sent === false ? (
                              <Badge variant="destructive" className="cursor-help">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            ) : (
                              <Badge variant="default" className="cursor-help">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Sent
                              </Badge>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-xs">
                              {invitation.email_error || 'Email sent successfully'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>{formatDate(invitation.invited_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{invitation.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {invitation.invite_link && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => copyToClipboard(invitation.invite_link!)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copy invitation link</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {invitation.email_sent === false && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleResendInvitation(invitation)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Resend invitation</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the invitation for <strong>{invitation.email}</strong>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteInvitation(invitation.id, invitation.email)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Link Dialog */}
      <Dialog open={inviteLinkDialog} onOpenChange={setInviteLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Shareable Invitation Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Email delivery failed, but the invitation was created. Share this link manually with the user:
            </p>
            <div className="flex gap-2">
              <Input 
                value={currentInviteLink} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(currentInviteLink)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setInviteLinkDialog(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t('userManagement')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fullName')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{t('created')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.full_name || t('noNameSet')}
                    </TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(profile.role)}>
                        {getRoleDisplayName(profile.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.active !== false ? "default" : "destructive"}>
                        {profile.active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(profile.created_at)}</TableCell>
                     <TableCell>
                       <div className="flex space-x-2">
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => {
                             setEditingProfile(profile);
                             setDialogOpen(true);
                           }}
                         >
                           <Edit className="h-3 w-3" />
                         </Button>
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => {
                             setUserToChangePassword(profile);
                             setPasswordDialogOpen(true);
                           }}
                         >
                           <Key className="h-3 w-3" />
                         </Button>
                        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setUserToDelete(profile)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('deleteUser')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {(t('deleteConfirmation') as string).replace('{name}', userToDelete?.full_name || userToDelete?.email || '')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => {
                                setDeleteDialogOpen(false);
                                setUserToDelete(null);
                              }}>
                                {t('cancel')}
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => userToDelete && deleteProfile(userToDelete)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t('deleteUser')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Catalog Data Migration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('catalog.migration.title')}
            </CardTitle>
            <CardDescription>{t('catalog.migration.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="outline"
              onClick={handleMigrationPreview}
              disabled={migrationPreviewLoading || migrationLoading}
            >
              {migrationPreviewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('catalog.migration.previewRunning')}
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  {t('catalog.migration.preview')}
                </>
              )}
            </Button>
          </div>
          
          {migrationResult && !migrationResult.dryRun && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {t('catalog.migration.migrationComplete')}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">{t('catalog.migration.catalogItemsCreated')}:</span>
                <span className="font-medium">{migrationResult.catalogItemsCreated}</span>
                <span className="text-muted-foreground">{t('catalog.migration.lotsLinked')}:</span>
                <span className="font-medium">{migrationResult.lotsLinked}</span>
                <span className="text-muted-foreground">{t('catalog.migration.incomingStockLinked')}:</span>
                <span className="font-medium">{migrationResult.incomingStockLinked}</span>
                <span className="text-muted-foreground">{t('catalog.migration.manufacturingOrdersLinked')}:</span>
                <span className="font-medium">{migrationResult.manufacturingOrdersLinked}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <InteractivePermissionsTab />
        </TabsContent>

        <TabsContent value="emailTemplates" className="space-y-6">
          <EmailTemplatesTab />
        </TabsContent>

        <TabsContent value="reminderSettings" className="space-y-6">
          <ReminderSettingsTab />
        </TabsContent>

        <TabsContent value="catalog" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('catalog.customFieldsAdmin.title')}</CardTitle>
              <CardDescription>{t('catalog.customFieldsAdmin.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogCustomFieldsAdmin 
                open={customFieldsDialogOpen} 
                onOpenChange={setCustomFieldsDialogOpen} 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('catalog.approvalSettings.title')}</CardTitle>
              <CardDescription>{t('catalog.approvalSettings.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogApprovalSettings 
                open={approvalSettingsOpen} 
                onOpenChange={setApprovalSettingsOpen} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orderFlow" className="space-y-6">
          <OrderFlowSettingsTab />
        </TabsContent>

        <TabsContent value="stocktake" className="space-y-6">
          <StockTakeSettingsTab />
        </TabsContent>

        {/* API Overview Tab */}
        <TabsContent value="apiOverview" className="space-y-6">
          <ApiOverviewTab />
        </TabsContent>

        {/* API Key Management Tab */}
        <TabsContent value="apiKeys" className="space-y-6">
          <ApiKeyManagementTab />
        </TabsContent>

        {/* Webhook Subscriptions Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <WebhookSubscriptionsTab />
        </TabsContent>

        {/* API Usage Dashboard Tab */}
        <TabsContent value="apiUsage" className="space-y-6">
          <ApiUsageDashboardTab />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {language === 'tr' ? 'İki Faktörlü Doğrulama (MFA)' : 'Two-Factor Authentication (MFA)'}
              </CardTitle>
              <CardDescription>
                {language === 'tr' 
                  ? 'Hesabınız için ek güvenlik katmanı ekleyin' 
                  : 'Add an extra layer of security to your account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MFASettings />
            </CardContent>
          </Card>
          <IPWhitelistTab />
        </TabsContent>

        <TabsContent value="auditRetention" className="space-y-6">
          <AuditRetentionSettings />
        </TabsContent>

        {/* Session Settings Tab */}
        <TabsContent value="sessionSettings" className="space-y-6">
          <SessionSettingsTab />
        </TabsContent>

        {/* Password Policy Tab */}
        <TabsContent value="passwordPolicy" className="space-y-6">
          <PasswordPolicyTab />
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog - only for existing users */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingProfile(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editUser')}</DialogTitle>
          </DialogHeader>
          {editingProfile ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingProfile.email}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="full_name">{t('fullName')}</Label>
                <Input
                  id="full_name"
                  value={editingProfile.full_name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">{t('role')}</Label>
                <Select 
                  value={editingProfile.role}
                  onValueChange={(value: UserRole) => setEditingProfile({ ...editingProfile, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse_staff">{t('warehouseStaffRole')}</SelectItem>
                    <SelectItem value="accounting">{t('accountingRole')}</SelectItem>
                    <SelectItem value="senior_manager">{t('seniorManagerRole')}</SelectItem>
                    <SelectItem value="admin">{t('adminRole')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setDialogOpen(false);
                  setEditingProfile(null);
                }}>
                  {t('cancel')}
                </Button>
                <Button onClick={() => updateProfile(editingProfile.id, {
                  full_name: editingProfile.full_name,
                  role: editingProfile.role
                })}>
                  {t('update')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{t('noUserSelected')}</p>
          )}
        </DialogContent>
      </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {userToChangePassword && (t('changePasswordFor') as string).replace('{name}', userToChangePassword.full_name || userToChangePassword.email)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newPassword">{t('newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('enterNewPasswordMinChars') as string}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmNewPasswordPlaceholder') as string}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setPasswordDialogOpen(false);
                  setUserToChangePassword(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}>
                  {t('cancel')}
                </Button>
                <Button onClick={() => userToChangePassword && changePassword(userToChangePassword)}>
                  {t('changePassword')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Deactivate User Dialog */}
        <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>User Has Associated Records</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-3">
                  <p>
                    {userToDeactivate && `User "${userToDeactivate.full_name || userToDeactivate.email}" has associated records:`}
                  </p>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {conflictDetails}
                  </p>
                  <p>
                    You can either <strong>reassign all records to yourself and delete the user</strong>, or <strong>deactivate the user</strong> (keeps data intact but prevents login).
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => {
                setDeactivateDialogOpen(false);
                setUserToDeactivate(null);
                setConflictDetails('');
              }}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => userToDeactivate && deleteProfile(userToDeactivate, true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Reassign & Delete
              </Button>
              <AlertDialogAction 
                onClick={() => userToDeactivate && deactivateProfile(userToDeactivate)}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                <UserX className="h-4 w-4 mr-2" />
                Deactivate User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Migration Preview Dialog */}
        <Dialog open={migrationDialogOpen} onOpenChange={setMigrationDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                {migrationResult?.dryRun 
                  ? t('catalog.migration.dryRunComplete') 
                  : t('catalog.migration.migrationComplete')}
              </DialogTitle>
            </DialogHeader>
            {migrationResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <span className="text-muted-foreground">{t('catalog.migration.uniquePairs')}:</span>
                  <span className="font-medium">{migrationResult.details?.uniquePairs || 0}</span>
                  <span className="text-muted-foreground">{t('catalog.migration.existingItems')}:</span>
                  <span className="font-medium">{migrationResult.details?.existingCatalogItems || 0}</span>
                  <span className="text-muted-foreground">
                    {migrationResult.dryRun 
                      ? t('catalog.migration.catalogItemsToCreate') 
                      : t('catalog.migration.catalogItemsCreated')}:
                  </span>
                  <span className="font-medium text-green-600">{migrationResult.catalogItemsCreated}</span>
                  <span className="text-muted-foreground">{t('catalog.migration.skippedExisting')}:</span>
                  <span className="font-medium">{migrationResult.skippedExisting}</span>
                  <span className="text-muted-foreground">
                    {migrationResult.dryRun 
                      ? t('catalog.migration.lotsToLink') 
                      : t('catalog.migration.lotsLinked')}:
                  </span>
                  <span className="font-medium">{migrationResult.lotsLinked || (migrationResult.dryRun ? '—' : 0)}</span>
                  <span className="text-muted-foreground">
                    {migrationResult.dryRun 
                      ? t('catalog.migration.incomingStockToLink') 
                      : t('catalog.migration.incomingStockLinked')}:
                  </span>
                  <span className="font-medium">{migrationResult.incomingStockLinked || (migrationResult.dryRun ? '—' : 0)}</span>
                  <span className="text-muted-foreground">
                    {migrationResult.dryRun 
                      ? t('catalog.migration.manufacturingOrdersToLink') 
                      : t('catalog.migration.manufacturingOrdersLinked')}:
                  </span>
                  <span className="font-medium">{migrationResult.manufacturingOrdersLinked || (migrationResult.dryRun ? '—' : 0)}</span>
                </div>

                {migrationResult.errors && migrationResult.errors.length > 0 && (
                  <div className="bg-destructive/10 p-3 rounded-md">
                    <p className="text-sm font-medium text-destructive mb-1">{t('catalog.migration.errors')}:</p>
                    <ul className="text-xs text-destructive space-y-1">
                      {migrationResult.errors.slice(0, 5).map((err: string, i: number) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {migrationResult.errors.length > 5 && (
                        <li>... {t('and')} {migrationResult.errors.length - 5} {t('more')}</li>
                      )}
                    </ul>
                  </div>
                )}

                {migrationResult.dryRun && migrationResult.catalogItemsCreated === 0 && (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {t('catalog.migration.noDataToMigrate')}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMigrationDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  {migrationResult.dryRun && migrationResult.catalogItemsCreated > 0 && (
                    <Button 
                      onClick={() => {
                        setMigrationDialogOpen(false);
                        handleMigrationRun();
                      }}
                      disabled={migrationLoading}
                    >
                      {migrationLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('catalog.migration.running')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {t('catalog.migration.run')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Migration Progress Dialog */}
        <MigrationProgressDialog
          open={migrationProgressOpen}
          onOpenChange={setMigrationProgressOpen}
          progress={migrationProgress}
          onCheckStatus={handleCheckMigrationStatus}
          onRerunMigration={handleMigrationRun}
        />
    </div>
  );
};

export default Admin;