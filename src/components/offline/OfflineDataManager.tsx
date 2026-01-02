import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Cloud,
  CloudOff,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useOfflineDataStore } from '@/hooks/useOfflineDataStore';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface StoreInfo {
  name: string;
  displayName: string;
  recordCount: number;
  lastSynced: Date | null;
}

export const OfflineDataManager: React.FC = () => {
  const { isOnline, syncStatus, forceSync, clearAllOfflineData, conflicts } = useOffline();
  const { isRegistered, triggerSync, clearCache } = useServiceWorker();
  const store = useOfflineDataStore();
  
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Load store information
  const loadStoreInfo = async () => {
    if (!store.isReady) return;
    
    setIsLoading(true);
    try {
      const storeNames = [
        { name: 'lots', displayName: 'Lots' },
        { name: 'catalog_items', displayName: 'Catalog Items' },
        { name: 'orders', displayName: 'Orders' },
        { name: 'reservations', displayName: 'Reservations' },
        { name: 'suppliers', displayName: 'Suppliers' },
        { name: 'sync_queue', displayName: 'Pending Sync' },
      ];
      
      const storeInfo: StoreInfo[] = [];
      
      for (const s of storeNames) {
        const records = await store.getAll(s.name);
        const lastSync = await store.getLastSyncTime(s.name);
        
        storeInfo.push({
          name: s.name,
          displayName: s.displayName,
          recordCount: records.length,
          lastSynced: lastSync ? new Date(lastSync) : null,
        });
      }
      
      setStores(storeInfo);
    } catch (err) {
      console.error('Failed to load store info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadStoreInfo();
  }, [store.isReady]);

  const handleForceSync = async () => {
    try {
      await forceSync();
      await loadStoreInfo();
      toast.success('Sync completed');
    } catch (err) {
      toast.error('Sync failed');
    }
  };

  const handleClearOfflineData = async () => {
    try {
      await clearAllOfflineData();
      await loadStoreInfo();
      toast.success('Offline data cleared');
    } catch (err) {
      toast.error('Failed to clear offline data');
    }
  };

  const totalRecords = stores.reduce((acc, s) => acc + s.recordCount, 0);
  const estimatedSize = Math.round(totalRecords * 0.5); // Rough estimate in KB

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? (
              <Cloud className="h-5 w-5 text-green-500" />
            ) : (
              <CloudOff className="h-5 w-5 text-destructive" />
            )}
            Connection Status
          </CardTitle>
          <CardDescription>
            {isOnline 
              ? 'Connected to server. Changes sync automatically.' 
              : 'Offline. Changes will sync when connection is restored.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{syncStatus.pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-destructive">{syncStatus.failedCount}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-yellow-500">{syncStatus.conflictCount}</div>
              <div className="text-xs text-muted-foreground">Conflicts</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{totalRecords}</div>
              <div className="text-xs text-muted-foreground">Cached Records</div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleForceSync} 
              disabled={!isOnline || syncStatus.isProcessing}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus.isProcessing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => triggerSync()} 
              disabled={!isRegistered}
              size="sm"
            >
              <Wifi className="h-4 w-4 mr-2" />
              Background Sync
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Cache
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Offline Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all cached data and pending changes. Any unsynced changes will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearOfflineData}>
                    Clear Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Sync Conflicts Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              {conflicts.length} record(s) have conflicts that need your attention. 
              Click on the conflict badge in the header to resolve them.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cached Data Stores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cached Data
          </CardTitle>
          <CardDescription>
            Estimated storage: ~{estimatedSize} KB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {stores.map((s) => (
                <div 
                  key={s.name} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{s.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.lastSynced 
                        ? `Last synced ${formatDistanceToNow(s.lastSynced, { addSuffix: true })}`
                        : 'Never synced'
                      }
                    </div>
                  </div>
                  <Badge variant={s.recordCount > 0 ? 'secondary' : 'outline'}>
                    {s.recordCount} records
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Offline Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-sync">Auto-sync when online</Label>
              <p className="text-xs text-muted-foreground">
                Automatically sync changes when connection is restored
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Service Worker</Label>
              <p className="text-xs text-muted-foreground">
                {isRegistered ? 'Active and ready' : 'Not registered'}
              </p>
            </div>
            <Badge variant={isRegistered ? 'default' : 'secondary'}>
              {isRegistered ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          
          <Separator />
          
          <div>
            <Label>Last Sync</Label>
            <p className="text-sm">
              {syncStatus.lastSyncAt 
                ? formatDistanceToNow(syncStatus.lastSyncAt, { addSuffix: true })
                : 'Never'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineDataManager;
