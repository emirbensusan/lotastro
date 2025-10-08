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
import { Users, Settings, Database, Shield, Plus, Edit, Trash2, UserCheck, Key, Loader2, Mail, UserX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import InteractivePermissionsTab from '@/components/InteractivePermissionsTab';
import { useLanguage } from '@/contexts/LanguageContext';

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
}

const Admin: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newProfile, setNewProfile] = useState({
    email: '',
    full_name: '',
    role: 'warehouse_staff' as UserRole
  });
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
  const { toast } = useToast();
  const { hasRole, loading: authLoading } = useAuth();
  const { t } = useLanguage();

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
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
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
    if (!inviteEmail || !inviteRole) {
      toast({
        title: 'Validation Error',
        description: 'Please provide email and role',
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

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Invitation sent successfully'
      });

      setInviteEmail('');
      setInviteRole('warehouse_staff');
      fetchPendingInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (authLoading) {
    return <div className="text-sm text-muted-foreground">{t('loading')}</div>;
  }
  if (!hasRole('admin')) {
    return <div className="text-sm text-muted-foreground">{t('notAuthorizedAccess')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('adminPanel')}</h1>
        <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('addUser')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">{t('userManagement')}</TabsTrigger>
          <TabsTrigger value="permissions">{t('permissions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
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
      <Card>
        <CardHeader>
          <CardTitle>Invite New Users</CardTitle>
          <CardDescription>Send invitations to new team members</CardDescription>
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
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
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
                    <TableCell>{formatDate(invitation.invited_at)}</TableCell>
                    <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{invitation.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <InteractivePermissionsTab />
        </TabsContent>
      </Tabs>

      {/* Edit/Add User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? t('editUser') : t('addNewUser')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={editingProfile ? editingProfile.email : newProfile.email}
                onChange={(e) => {
                  if (editingProfile) {
                    setEditingProfile({ ...editingProfile, email: e.target.value });
                  } else {
                    setNewProfile({ ...newProfile, email: e.target.value });
                  }
                }}
                disabled={!!editingProfile}
              />
            </div>
            <div>
              <Label htmlFor="full_name">{t('fullName')}</Label>
              <Input
                id="full_name"
                value={editingProfile ? editingProfile.full_name : newProfile.full_name}
                onChange={(e) => {
                  if (editingProfile) {
                    setEditingProfile({ ...editingProfile, full_name: e.target.value });
                  } else {
                    setNewProfile({ ...newProfile, full_name: e.target.value });
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="role">{t('role')}</Label>
              <Select 
                value={editingProfile ? editingProfile.role : newProfile.role}
                onValueChange={(value: UserRole) => {
                  if (editingProfile) {
                    setEditingProfile({ ...editingProfile, role: value });
                  } else {
                    setNewProfile({ ...newProfile, role: value });
                  }
                }}
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
                setNewProfile({ email: '', full_name: '', role: 'warehouse_staff' as UserRole });
              }}>
                {t('cancel')}
              </Button>
              <Button onClick={async () => {
                if (editingProfile) {
                  updateProfile(editingProfile.id, {
                    full_name: editingProfile.full_name,
                    role: editingProfile.role
                  });
                } else {
                  // Create new user
                  try {
                    setLoading(true);
                    
                    // Generate a cryptographically secure temporary password
                    const generateSecurePassword = () => {
                      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                      const array = new Uint8Array(16);
                      crypto.getRandomValues(array);
                      let password = '';
                      for (let i = 0; i < array.length; i++) {
                        password += charset[array[i] % charset.length];
                      }
                      return password;
                    };
                    const tempPassword = generateSecurePassword();
                    
                    const { data, error } = await supabase.auth.signUp({
                      email: newProfile.email,
                      password: tempPassword,
                      options: {
                        emailRedirectTo: 'https://depo.lotastro.com/auth',
                        data: {
                          full_name: newProfile.full_name,
                          role: newProfile.role
                        }
                      }
                    });

                    if (error) throw error;

                    toast({
                      title: t('userCreatedSuccessfully') as string,
                      description: (t('userCreatedTempPassword') as string).replace('{password}', tempPassword),
                    });

                    setDialogOpen(false);
                    setNewProfile({ email: '', full_name: '', role: 'warehouse_staff' });
                    fetchProfiles();
                    
                  } catch (error: any) {
                    toast({
                      title: t('userCreationFailed') as string,
                      description: error.message || (t('failedToCreateUser') as string),
                      variant: 'destructive',
                    });
                  } finally {
                    setLoading(false);
                  }
                }
              }}>
                {editingProfile ? t('update') : t('create')}
              </Button>
            </div>
          </div>
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
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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
    </div>
  );
};

export default Admin;