import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2 } from 'lucide-react';

interface AutocompleteInputProps {
  type: 'quality' | 'color';
  value: string;
  onChange: (value: string) => void;
  quality?: string; // For color autocomplete filtering
  placeholder?: string;
  className?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  type,
  value,
  onChange,
  quality,
  placeholder,
  className
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const functionName = type === 'quality' ? 'autocomplete-qualities' : 'autocomplete-colors';
      const params: Record<string, string> = { query };
      
      if (type === 'color' && quality) {
        params.quality = quality;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: params
      });

      if (error) throw error;

      setSuggestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(`Error fetching ${type} suggestions:`, error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 200);

    if (newValue.length >= 3) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setSuggestions([]);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder || (type === 'quality' ? t('aiOrder.searchQuality') : t('aiOrder.searchColor')) as string}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loading && suggestions.length === 0 && (
              <CommandEmpty>{t('aiOrder.noResults')}</CommandEmpty>
            )}
            {!loading && suggestions.length > 0 && (
              <CommandGroup>
                {suggestions.map((item, index) => (
                  <CommandItem
                    key={index}
                    value={type === 'quality' ? item.code : item.color_label}
                    onSelect={() => handleSelect(type === 'quality' ? item.code : item.color_label)}
                  >
                    {type === 'quality' ? (
                      <span className="font-mono">{item.code}</span>
                    ) : (
                      <div className="flex flex-col">
                        <span>{item.color_label}</span>
                        {item.color_code && (
                          <span className="text-xs text-muted-foreground">Code: {item.color_code}</span>
                        )}
                        {!quality && (
                          <span className="text-xs text-muted-foreground">Quality: {item.quality_code}</span>
                        )}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
