import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, Package, Truck, Building2 } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'lot' | 'order' | 'supplier';
  title: string;
  subtitle: string;
  path: string;
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

      // Search lots
      const { data: lots } = await supabase
        .from('lots')
        .select('*, suppliers(name)')
        .or(`lot_number.ilike.%${searchQuery}%,quality.ilike.%${searchQuery}%,color.ilike.%${searchQuery}%`)
        .limit(5);

      if (lots) {
        lots.forEach(lot => {
          searchResults.push({
            id: lot.id,
            type: 'lot',
            title: `LOT ${lot.lot_number}`,
            subtitle: `${lot.quality} - ${lot.color} (${lot.meters}m)`,
            path: `/inventory`
          });
        });
      }

      // Search orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%`)
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
        .ilike('name', `%${searchQuery}%`)
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
      case 'lot': return <Package className="h-4 w-4" />;
      case 'order': return <Truck className="h-4 w-4" />;
      case 'supplier': return <Building2 className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'lot': return 'default';
      case 'order': return 'secondary';
      case 'supplier': return 'outline';
      default: return 'outline';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={searchRef} className="relative w-96">
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
          className="pl-10"
        />
      </div>

      {isOpen && (query.length > 2 || results.length > 0) && (
        <Card className="absolute top-full mt-1 w-full z-50 max-h-96 overflow-y-auto">
          <CardContent className="p-2">
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
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <div className="flex-shrink-0">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{result.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.subtitle}
                        </div>
                      </div>
                      <Badge variant={getBadgeVariant(result.type)}>
                        {result.type.toUpperCase()}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GlobalSearch;