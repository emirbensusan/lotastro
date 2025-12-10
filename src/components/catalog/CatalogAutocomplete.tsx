import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface CatalogItem {
  id: string;
  code: string;
  color_name: string;
  status: string;
  lastro_sku_code: string;
}

interface CatalogAutocompleteProps {
  value: { quality: string; color: string; catalog_item_id: string | null };
  onChange: (value: { quality: string; color: string; catalog_item_id: string | null }) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNonCatalog?: boolean;
  className?: string;
}

export const CatalogAutocomplete: React.FC<CatalogAutocompleteProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  allowNonCatalog = true,
  className,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build display value from quality and color
  const displayValue = value.quality && value.color 
    ? `${value.quality} - ${value.color}` 
    : value.quality || '';

  useEffect(() => {
    if (open && searchQuery.length >= 2) {
      fetchCatalogItems(searchQuery);
    } else if (open && searchQuery.length === 0) {
      fetchCatalogItems('');
    }
  }, [searchQuery, open]);

  const fetchCatalogItems = async (query: string) => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('catalog_items')
        .select('id, code, color_name, status, lastro_sku_code')
        .order('code')
        .limit(20);

      if (query) {
        queryBuilder = queryBuilder.or(`code.ilike.%${query}%,color_name.ilike.%${query}%`);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching catalog items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: CatalogItem) => {
    if (isInactiveStatus(item.status)) {
      return; // Block selection of inactive items
    }
    onChange({
      quality: item.code,
      color: item.color_name,
      catalog_item_id: item.id,
    });
    setSearchQuery('');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    
    // If user is typing manually, allow free text if allowNonCatalog is true
    if (allowNonCatalog) {
      // Parse input as "quality - color" or just "quality"
      const parts = newValue.split(' - ');
      onChange({
        quality: parts[0] || '',
        color: parts[1] || '',
        catalog_item_id: null, // Clear catalog link when typing manually
      });
    }
    
    if (!open) setOpen(true);
  };

  const handleCreateNew = () => {
    const params = new URLSearchParams();
    if (value.quality) params.set('code', value.quality);
    if (value.color) params.set('color', value.color);
    navigate(`/catalog/new?${params.toString()}`);
    setOpen(false);
  };

  const isInactiveStatus = (status: string) => {
    return status === 'inactive' || status === 'blocked' || status === 'end_of_life';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">{String(t('catalog.status.active'))}</Badge>;
      case 'pending_approval':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">{String(t('catalog.status.pending'))}</Badge>;
      case 'inactive':
      case 'blocked':
      case 'end_of_life':
      case 'temporarily_unavailable':
        return <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">{String(t('catalog.status.inactive'))}</Badge>;
      default:
        return null;
    }
  };

  const showCreateOption = searchQuery.length >= 2 && 
    !items.some(item => 
      item.code.toLowerCase() === searchQuery.toLowerCase() || 
      `${item.code} - ${item.color_name}`.toLowerCase() === searchQuery.toLowerCase()
    );

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={open ? searchQuery : displayValue}
              onChange={handleInputChange}
              onFocus={() => {
                setSearchQuery(displayValue);
                setOpen(true);
              }}
              placeholder={placeholder || String(t('catalog.autocomplete.placeholder'))}
              disabled={disabled}
              className="pr-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2"
              onClick={() => setOpen(!open)}
              disabled={disabled}
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] max-h-72 overflow-hidden p-0 z-50" 
          align="start"
        >
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t('loading')}...
              </div>
            ) : items.length === 0 && searchQuery.length >= 2 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t('catalog.autocomplete.noResults')}
              </div>
            ) : (
              <div className="py-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    disabled={item.status === 'inactive'}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors",
                      item.status === 'inactive' && "opacity-50 cursor-not-allowed hover:bg-transparent",
                      value.catalog_item_id === item.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value.catalog_item_id === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-medium truncate">
                          {item.code} - {item.color_name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {item.lastro_sku_code}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {getStatusBadge(item.status)}
                      {item.status === 'inactive' && (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                ))}
                
                {/* Create new option */}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent transition-colors border-t"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('catalog.autocomplete.createNew')}: "{searchQuery}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Hint for manual entry */}
          {allowNonCatalog && (
            <div className="border-t p-2 text-xs text-muted-foreground bg-muted/50">
              {t('catalog.autocomplete.manualEntryHint')}
            </div>
          )}
        </PopoverContent>
      </Popover>
      
      {/* Show linked catalog item indicator */}
      {value.catalog_item_id && (
        <div className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" />
          {t('catalog.autocomplete.linkedToCatalog')}
        </div>
      )}
    </div>
  );
};
