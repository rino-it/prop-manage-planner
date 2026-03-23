import React, { useState, useEffect } from 'react';
import { Bell, Check, FileText, AlertTriangle, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

export default function AdminNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isRealtimeConnected,
  } = useAdminNotifications();

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'documento_caricato':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'scadenza_preventivo':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priorita: string) => {
    switch (priorita) {
      case 'critica':
        return 'bg-red-100 border-red-500 hover:bg-red-50';
      case 'alta':
        return 'bg-orange-100 border-orange-500 hover:bg-orange-50';
      case 'media':
        return 'bg-yellow-100 border-yellow-500 hover:bg-yellow-50';
      default:
        return 'bg-gray-100 border-gray-500 hover:bg-gray-50';
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    setIsOpen(false);

    // Navigate based on notification type
    if (notification.tipo === 'documento_caricato' && notification.booking_id) {
      navigate(`/bookings?highlight=${notification.booking_id}`);
    } else if (notification.tipo === 'scadenza_preventivo' && notification.ticket_id) {
      navigate(`/tickets?highlight=${notification.ticket_id}`);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-600 hover:bg-slate-100"
          aria-label={`Notifiche: ${unreadCount} non lette`}
        >
          <Bell className="h-5 w-5" />

          {/* Unread badge with pulse */}
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse border-2 border-white" />
              {unreadCount > 9 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </>
          )}

          {/* Connection status indicator */}
          {!isRealtimeConnected && (
            <WifiOff
              className="absolute bottom-0 right-0 h-3 w-3 text-yellow-600"
              title="Realtime disconnected - using polling"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] p-0 mr-4 shadow-2xl border-slate-200" align="end">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h4 className="font-bold text-slate-800 text-lg">Notifiche Admin</h4>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="px-2 h-6">
                  {unreadCount}
                </Badge>
              )}
              {isRealtimeConnected ? (
                <Wifi className="h-4 w-4 text-green-500" title="Realtime connesso" />
              ) : (
                <WifiOff className="h-4 w-4 text-yellow-600" title="Modalità offline" />
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => markAllAsRead()}
              >
                <Check className="w-3 h-3 mr-1" />
                Segna tutte
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="h-[500px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
              <Bell className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Nessuna notifica</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-blue-50 cursor-pointer transition-all border-l-4 ${getPriorityColor(
                    notification.priorita
                  )}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getNotificationIcon(notification.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm text-slate-900 line-clamp-1">
                          {notification.titolo}
                        </p>
                        {notification.priorita === 'critica' && (
                          <Badge variant="destructive" className="ml-2 text-[10px] shrink-0">
                            URGENTE
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2">
                        {notification.messaggio}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: it,
                          })}
                        </span>
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {notification.tipo.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
