import React, { useState, useMemo } from 'react';
import { useMessages, Message } from '@/hooks/useMessages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle, Mail, Phone, Inbox, Search, CheckCheck,
  Loader2, Trash2, Eye, Filter, User, Bot, Home
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';

type ChannelFilter = 'all' | 'whatsapp' | 'email' | 'internal';
type ReadFilter = 'all' | 'unread' | 'read';

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: Phone,
  email: Mail,
  internal: MessageCircle,
};

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  internal: 'Interno',
};

const senderLabels: Record<string, string> = {
  host: 'Tu',
  guest: 'Ospite',
  system: 'Sistema',
};

const senderIcons: Record<string, React.ElementType> = {
  host: User,
  guest: User,
  system: Bot,
};

function groupMessagesByBooking(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};
  for (const msg of messages) {
    const key = msg.booking_id || 'no-booking';
    if (!groups[key]) groups[key] = [];
    groups[key].push(msg);
  }
  return groups;
}

function getGroupLabel(messages: Message[]): string {
  const first = messages[0];
  if (first.bookings?.nome_ospite) {
    const propName = first.bookings.properties_real?.nome || first.properties_real?.nome;
    return propName
      ? `${first.bookings.nome_ospite} - ${propName}`
      : first.bookings.nome_ospite;
  }
  if (first.properties_real?.nome) return first.properties_real.nome;
  return 'Messaggi generali';
}

export default function Messages() {
  const { messages, isLoading, unreadCount, markAsRead, markAllAsRead, deleteMessage } = useMessages();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = messages;

    if (channelFilter !== 'all') {
      result = result.filter((m) => m.channel === channelFilter);
    }

    if (readFilter === 'unread') {
      result = result.filter((m) => !m.read);
    } else if (readFilter === 'read') {
      result = result.filter((m) => m.read);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.content.toLowerCase().includes(q) ||
          m.bookings?.nome_ospite?.toLowerCase().includes(q) ||
          m.properties_real?.nome?.toLowerCase().includes(q) ||
          m.bookings?.properties_real?.nome?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [messages, channelFilter, readFilter, search]);

  const grouped = useMemo(() => groupMessagesByBooking(filtered), [filtered]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const aLatest = grouped[a][0]?.created_at || '';
      const bLatest = grouped[b][0]?.created_at || '';
      return bLatest.localeCompare(aLatest);
    });
  }, [grouped]);

  const activeGroupMessages = selectedGroup && grouped[selectedGroup]
    ? grouped[selectedGroup]
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Messaggi" count={unreadCount} countLabel="Non letti:" />

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca messaggi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={channelFilter} onValueChange={(v) => setChannelFilter(v as ChannelFilter)}>
          <TabsList>
            <TabsTrigger value="all">Tutti</TabsTrigger>
            <TabsTrigger value="internal">Interno</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={readFilter} onValueChange={(v) => setReadFilter(v as ReadFilter)}>
          <TabsList>
            <TabsTrigger value="all">Tutti</TabsTrigger>
            <TabsTrigger value="unread">Non letti</TabsTrigger>
            <TabsTrigger value="read">Letti</TabsTrigger>
          </TabsList>
        </Tabs>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Segna tutti letti
          </Button>
        )}
      </div>

      {sortedGroupKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Nessun messaggio</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              I messaggi appariranno qui quando verranno inviati o ricevuti.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold">Conversazioni</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="px-2 pb-2 space-y-0.5">
                {sortedGroupKeys.map((key) => {
                  const groupMsgs = grouped[key];
                  const label = getGroupLabel(groupMsgs);
                  const latest = groupMsgs[0];
                  const unread = groupMsgs.filter((m) => !m.read).length;
                  const isActive = selectedGroup === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedGroup(key)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
                        isActive
                          ? 'bg-primary/8 border border-primary/20'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{label}</span>
                        {unread > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px]">
                            {unread}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {latest.content.slice(0, 60)}{latest.content.length > 60 ? '...' : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {(() => {
                          const ChannelIcon = channelIcons[latest.channel] || MessageCircle;
                          return <ChannelIcon className="h-3 w-3 text-muted-foreground/60" />;
                        })()}
                        <span className="text-[11px] text-muted-foreground/60">
                          {format(new Date(latest.created_at), 'dd MMM HH:mm', { locale: it })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          <Card className="lg:col-span-2">
            {activeGroupMessages ? (
              <>
                <CardHeader className="py-3 px-4 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {getGroupLabel(activeGroupMessages)}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {activeGroupMessages.length} messaggi
                    </span>
                  </div>
                </CardHeader>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="p-4 space-y-3">
                    {[...activeGroupMessages].reverse().map((msg) => {
                      const SenderIcon = senderIcons[msg.sender_type] || User;
                      const ChannelIcon = channelIcons[msg.channel] || MessageCircle;
                      const isHost = msg.sender_type === 'host';
                      const isSystem = msg.sender_type === 'system';

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex gap-3',
                            isHost ? 'flex-row-reverse' : 'flex-row'
                          )}
                        >
                          <div
                            className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                              isSystem ? 'bg-amber-100' : isHost ? 'bg-primary/10' : 'bg-muted'
                            )}
                          >
                            <SenderIcon className={cn(
                              'h-4 w-4',
                              isSystem ? 'text-amber-600' : isHost ? 'text-primary' : 'text-muted-foreground'
                            )} />
                          </div>

                          <div
                            className={cn(
                              'max-w-[75%] rounded-lg px-3 py-2',
                              isHost ? 'bg-primary/5 border border-primary/10' :
                              isSystem ? 'bg-amber-50 border border-amber-100' :
                              'bg-muted/50 border border-border'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">
                                {senderLabels[msg.sender_type]}
                              </span>
                              <ChannelIcon className="h-3 w-3 text-muted-foreground/50" />
                              <span className="text-[11px] text-muted-foreground/60">
                                {channelLabels[msg.channel]}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[11px] text-muted-foreground/50">
                                {format(new Date(msg.created_at), 'dd MMM yyyy HH:mm', { locale: it })}
                              </span>
                              <div className="flex items-center gap-1">
                                {!msg.read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => markAsRead.mutate(msg.id)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteMessage.mutate(msg.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center h-[calc(100vh-320px)] text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Seleziona una conversazione per visualizzare i messaggi
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
