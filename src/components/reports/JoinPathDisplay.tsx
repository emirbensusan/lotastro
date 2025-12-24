import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Link2, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one';
}

interface JoinPathDisplayProps {
  joinPath: TableRelationship[];
  selectedTables: string[];
  canJoin: boolean;
  error?: string;
}

const TABLE_LABELS: Record<string, { en: string; tr: string }> = {
  lots: { en: 'Lots', tr: 'Lotlar' },
  incoming_stock: { en: 'Incoming Stock', tr: 'Gelen Stok' },
  reservations: { en: 'Reservations', tr: 'Rezervasyonlar' },
  reservation_lines: { en: 'Reservation Lines', tr: 'Rezervasyon Satırları' },
  manufacturing_orders: { en: 'Manufacturing Orders', tr: 'Üretim Siparişleri' },
  orders: { en: 'Orders', tr: 'Siparişler' },
  suppliers: { en: 'Suppliers', tr: 'Tedarikçiler' },
  catalog_items: { en: 'Catalog Items', tr: 'Katalog Ürünleri' },
  audit_logs: { en: 'Audit Logs', tr: 'Denetim Kayıtları' },
  demand_history: { en: 'Demand History', tr: 'Talep Geçmişi' },
};

export const JoinPathDisplay: React.FC<JoinPathDisplayProps> = ({
  joinPath,
  selectedTables,
  canJoin,
  error,
}) => {
  const { language } = useLanguage();

  if (selectedTables.length <= 1 && !error) {
    return null;
  }

  const getTableLabel = (table: string) => {
    return TABLE_LABELS[table]?.[language === 'tr' ? 'tr' : 'en'] || table;
  };

  const getRelationshipLabel = (rel: TableRelationship) => {
    switch (rel.type) {
      case 'one-to-many':
        return '1:N';
      case 'many-to-one':
        return 'N:1';
      case 'one-to-one':
        return '1:1';
      default:
        return '';
    }
  };

  return (
    <Card className={cn(
      "border-2",
      canJoin ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
    )}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          {canJoin ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{language === 'tr' ? 'Tablolar Bağlantılı' : 'Tables Connected'}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>{language === 'tr' ? 'Bağlantı Hatası' : 'Connection Error'}</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : joinPath.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              {language === 'tr' ? 'Otomatik JOIN yolu:' : 'Auto-detected JOIN path:'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {joinPath.map((rel, index) => (
                <React.Fragment key={index}>
                  {index === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {getTableLabel(rel.fromTable)}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-xs font-mono">
                      {rel.fromColumn} → {rel.toColumn}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {getRelationshipLabel(rel)}
                    </Badge>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {getTableLabel(rel.toTable)}
                  </Badge>
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : selectedTables.length > 1 ? (
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              {language === 'tr' ? 'Tablolar doğrudan bağlı' : 'Tables directly connected'}
            </span>
          </div>
        ) : null}
        
        {canJoin && selectedTables.length > 1 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {language === 'tr' 
                ? `${selectedTables.length} tablo birleştirilecek: ${selectedTables.map(t => getTableLabel(t)).join(', ')}`
                : `${selectedTables.length} tables will be joined: ${selectedTables.map(t => getTableLabel(t)).join(', ')}`
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
