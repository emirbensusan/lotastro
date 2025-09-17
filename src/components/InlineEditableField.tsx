import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, X, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditableFieldProps {
  value: string | number;
  type?: 'text' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  onSave: (newValue: string | number) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  displayValue?: string;
}

export const InlineEditableField: React.FC<InlineEditableFieldProps> = ({
  value,
  type = 'text',
  options = [],
  onSave,
  disabled = false,
  placeholder,
  className,
  displayValue
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === value.toString()) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const finalValue = type === 'number' ? Number(editValue) : editValue;
      await onSave(finalValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {displayValue || value}
      </span>
    );
  }

  if (!isEditing) {
    return (
      <div 
        className={cn(
          "group flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1",
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <span>{displayValue || value}</span>
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  if (type === 'select' && options.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="h-8 min-w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={handleSave} disabled={isLoading}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 min-w-[100px]"
        placeholder={placeholder}
      />
      <Button size="sm" variant="ghost" onClick={handleSave} disabled={isLoading}>
        <Check className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isLoading}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};