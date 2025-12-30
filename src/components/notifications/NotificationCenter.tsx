import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, AlertTriangle, ShoppingCart, Package, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';

export function NotificationCenter() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const isEnglish = language === 'en';

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'approval_required':
      case 'approval_completed':
        return <Check className="h-4 w-4" />;
      case 'low_stock_alert':
        return <AlertTriangle className="h-4 w-4" />;
      case 'order_status_change':
        return <ShoppingCart className="h-4 w-4" />;
      case 'sync_conflict':
        return <Package className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getIconColor = (type: Notification['type']) => {
    switch (type) {
      case 'approval_required':
        return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      case 'approval_completed':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'low_stock_alert':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'order_status_change':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link_url) {
      navigate(notification.link_url);
      setOpen(false);
    }
  };

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: isEnglish ? enUS : tr
    });
  };

  const alertNotifications = notifications.filter(n => 
    n.type === 'low_stock_alert' || n.type === 'sync_conflict'
  );
  const approvalNotifications = notifications.filter(n => 
    n.type === 'approval_required' || n.type === 'approval_completed'
  );

  const renderNotificationList = (items: Notification[]) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {isEnglish ? 'No notifications' : 'Bildirim yok'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {items.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
              !notification.is_read ? 'bg-muted/30' : ''
            }`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className={`flex-shrink-0 p-2 rounded-full ${getIconColor(notification.type)}`}>
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${!notification.is_read ? 'font-medium' : ''}`}>
                  {notification.title}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(notification.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(notification.created_at)}
              </p>
            </div>
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-tour="notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">
            {isEnglish ? 'Notifications' : 'Bildirimler'}
          </h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {isEnglish ? 'Mark all read' : 'Tümünü okundu yap'}
            </Button>
          )}
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-9 rounded-none border-b">
            <TabsTrigger value="all" className="text-xs rounded-none">
              {isEnglish ? 'All' : 'Tümü'}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs rounded-none">
              {isEnglish ? 'Alerts' : 'Uyarılar'}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs rounded-none">
              {isEnglish ? 'Approvals' : 'Onaylar'}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[320px]">
            <TabsContent value="all" className="m-0 p-2">
              {renderNotificationList(notifications)}
            </TabsContent>
            <TabsContent value="alerts" className="m-0 p-2">
              {renderNotificationList(alertNotifications)}
            </TabsContent>
            <TabsContent value="approvals" className="m-0 p-2">
              {renderNotificationList(approvalNotifications)}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
