import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, Package, Truck, Building2, X } from 'lucide-react';
interface SearchResult {
  id: string;
  type: 'lot' | 'order' | 'supplier' | 'quality' | 'quality-color';
  title: string;
  subtitle: string;
  path: string;
  metadata?: {
    totalMeters?: number;
    totalRolls?: number;
    lotCount?: number;
  };
}

const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    if (query.length > 2) {
      searchAll(query);
    } else {
      setResults([]);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAll = async (searchQuery: string) => {
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];
      const trimmedQuery = searchQuery.trim();
      const queryWords = trimmedQuery.split(/\s+/);
      
      // Detect if this is a compound search (quality + color)
      const isCompoundSearch = queryWords.length > 1;

      // Search for quality aggregations (single word searches)
      if (!isCompoundSearch) {
        const { data: qualityData } = await supabase
          .from('lots')
          .select('quality, color, meters, roll_count')
          .eq('status', 'in_stock')
          .ilike('quality', `%${trimmedQuery}%`)
          .limit(20);

        if (qualityData && qualityData.length > 0) {
          // Normalize and aggregate by quality
          const qualityMap = new Map<string, { qualities: Set<string>, colors: Set<string>, totalMeters: number, totalRolls: number, lotCount: number }>();
          
          for (const lot of qualityData) {
            const { data: normalized } = await supabase.rpc('normalize_quality', { quality_input: lot.quality });
            const normalizedQuality = normalized || lot.quality;
            
            if (!qualityMap.has(normalizedQuality)) {
              qualityMap.set(normalizedQuality, { qualities: new Set(), colors: new Set(), totalMeters: 0, totalRolls: 0, lotCount: 0 });
            }
            
            const entry = qualityMap.get(normalizedQuality)!;
            entry.qualities.add(lot.quality);
            entry.colors.add(lot.color);
            entry.totalMeters += Number(lot.meters);
            entry.totalRolls += lot.roll_count;
            entry.lotCount += 1;
          }

          // Add quality results
          for (const [normalizedQuality, data] of qualityMap.entries()) {
            searchResults.push({
              id: `quality-${normalizedQuality}`,
              type: 'quality',
              title: `Quality: ${Array.from(data.qualities)[0]}`,
              subtitle: `${data.colors.size} colors, ${Math.round(data.totalMeters)}m total`,
              path: `/inventory/${encodeURIComponent(normalizedQuality)}`,
              metadata: { totalMeters: data.totalMeters, totalRolls: data.totalRolls, lotCount: data.lotCount }
            });
          }
        }
      }

      // Search for quality+color combinations (compound searches)
      if (isCompoundSearch) {
        const qualityTerm = queryWords[0];
        const colorTerm = queryWords.slice(1).join(' ');
        
        const { data: qualityColorData } = await supabase
          .from('lots')
          .select('quality, color, meters, roll_count')
          .eq('status', 'in_stock')
          .ilike('quality', `%${qualityTerm}%`)
          .ilike('color', `%${colorTerm}%`)
          .limit(10);

        if (qualityColorData && qualityColorData.length > 0) {
          // Aggregate by normalized quality + color
          const qualityColorMap = new Map<string, { quality: string, color: string, totalMeters: number, totalRolls: number, lotCount: number }>();
          
          for (const lot of qualityColorData) {
            const { data: normalized } = await supabase.rpc('normalize_quality', { quality_input: lot.quality });
            const normalizedQuality = normalized || lot.quality;
            const key = `${normalizedQuality}|${lot.color}`;
            
            if (!qualityColorMap.has(key)) {
              qualityColorMap.set(key, { quality: lot.quality, color: lot.color, totalMeters: 0, totalRolls: 0, lotCount: 0 });
            }
            
            const entry = qualityColorMap.get(key)!;
            entry.totalMeters += Number(lot.meters);
            entry.totalRolls += lot.roll_count;
            entry.lotCount += 1;
          }

          // Add quality-color results
          for (const [key, data] of qualityColorMap.entries()) {
            const [normalizedQuality, color] = key.split('|');
            searchResults.push({
              id: `quality-color-${key}`,
              type: 'quality-color',
              title: `${data.quality} - ${color}`,
              subtitle: `${Math.round(data.totalMeters)}m, ${data.totalRolls} rolls, ${data.lotCount} lots`,
              path: `/inventory/${encodeURIComponent(normalizedQuality)}/${encodeURIComponent(color)}`,
              metadata: { totalMeters: data.totalMeters, totalRolls: data.totalRolls, lotCount: data.lotCount }
            });
          }
        }
      }

      // Search individual lots (by lot number or general search)
      const { data: lots } = await supabase
        .from('lots')
        .select('*, suppliers(name)')
        .or(`lot_number.ilike.%${trimmedQuery}%,quality.ilike.%${trimmedQuery}%,color.ilike.%${trimmedQuery}%`)
        .limit(5);

      if (lots) {
        for (const lot of lots) {
          const { data: normalized } = await supabase.rpc('normalize_quality', { quality_input: lot.quality });
          const normalizedQuality = normalized || lot.quality;
          
          searchResults.push({
            id: lot.id,
            type: 'lot',
            title: `LOT ${lot.lot_number}`,
            subtitle: `${lot.quality} - ${lot.color} (${lot.meters}m)`,
            path: `/inventory/${encodeURIComponent(normalizedQuality)}/${encodeURIComponent(lot.color)}`
          });
        }
      }

      // Search orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.ilike.%${trimmedQuery}%,customer_name.ilike.%${trimmedQuery}%`)
        .limit(5);

      if (orders) {
        orders.forEach(order => {
          searchResults.push({
            id: order.id,
            type: 'order',
            title: `Order ${order.order_number}`,
            subtitle: order.customer_name,
            path: `/orders`
          });
        });
      }

      // Search suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .ilike('name', `%${trimmedQuery}%`)
        .limit(3);

      if (suppliers) {
        suppliers.forEach(supplier => {
          searchResults.push({
            id: supplier.id,
            type: 'supplier',
            title: supplier.name,
            subtitle: 'Supplier',
            path: `/suppliers`
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'quality': return <Package className="h-4 w-4" />;
      case 'quality-color': return <Package className="h-4 w-4" />;
      case 'lot': return <Package className="h-4 w-4" />;
      case 'order': return <Truck className="h-4 w-4" />;
      case 'supplier': return <Building2 className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case 'quality': return 'default';
      case 'quality-color': return 'secondary';
      case 'lot': return 'outline';
      case 'order': return 'secondary';
      case 'supplier': return 'outline';
      default: return 'outline';
    }
  };

  const getBadgeText = (type: string) => {
    switch (type) {
      case 'quality': return 'QUALITY';
      case 'quality-color': return 'COLOR';
      case 'lot': return 'LOT';
      case 'order': return 'ORDER';
      case 'supplier': return 'SUPPLIER';
      default: return type.toUpperCase();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.path);
    setIsOpen(false);
    setQuery('');
  };

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const handleMobileResultClick = (result: SearchResult) => {
    navigate(result.path);
    setMobileSheetOpen(false);
    setIsOpen(false);
    setQuery('');
  };

  const SearchResults = ({ onResultClick }: { onResultClick: (result: SearchResult) => void }) => (
    <>
      {loading ? (
        <div className="py-4 text-center text-muted-foreground">
          {t('loading')}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-1">
          {results.map((result) => (
            <Button
              key={`${result.type}-${result.id}`}
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={() => onResultClick(result)}
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="flex-shrink-0">
                  {getIcon(result.type)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium truncate">{result.title}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {result.subtitle}
                  </div>
                </div>
                <Badge variant={getBadgeVariant(result.type)} className="flex-shrink-0">
                  {getBadgeText(result.type)}
                </Badge>
              </div>
            </Button>
          ))}
        </div>
      ) : query.length > 2 ? (
        <div className="py-4 text-center text-muted-foreground">
          No results found for "{query}"
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {/* Desktop Search - hidden on mobile */}
      <div ref={searchRef} className="relative hidden sm:block w-48 md:w-64 lg:w-80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={t('searchPlaceholder') as string}
            className="pl-10 h-8"
          />
        </div>

        {isOpen && (query.length > 2 || results.length > 0) && (
          <Card className="absolute top-full mt-1 w-full z-50 max-h-96 overflow-y-auto">
            <CardContent className="p-2">
              <SearchResults onResultClick={handleResultClick} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile Search - icon that opens sheet */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8">
            <Search className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="h-auto max-h-[80vh]">
          <SheetHeader className="pb-2">
            <SheetTitle>{t('search')}</SheetTitle>
          </SheetHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder={t('searchPlaceholder') as string}
              className="pl-10"
              autoFocus
            />
            {query && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {(query.length > 2 || results.length > 0) && (
            <div className="mt-2 max-h-[50vh] overflow-y-auto">
              <SearchResults onResultClick={handleMobileResultClick} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default GlobalSearch;