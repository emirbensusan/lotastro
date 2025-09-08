import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AutocompleteProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  items: string[]
  emptyText?: string
  className?: string
  minCharsToShow?: number
}

export function Autocomplete({
  value = "",
  onValueChange,
  placeholder = "Search...",
  items = [],
  emptyText = "No results found.",
  className,
  minCharsToShow = 3
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const filteredItems = React.useMemo(() => {
    if (inputValue.length === 0) {
      // Show all items when focusing on empty field
      return items.slice(0, 10)
    }
    if (inputValue.length < minCharsToShow) return []
    return items.filter(item =>
      item.toLowerCase().includes(inputValue.toLowerCase())
    ).slice(0, 10) // Limit to 10 results for performance
  }, [items, inputValue, minCharsToShow])

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue)
    onValueChange?.(newValue)
    // Show dropdown when we have input OR when focusing on empty field, and we have items
    const shouldShow = (newValue.length >= minCharsToShow || newValue.length === 0) && items.length > 0
    setOpen(shouldShow)
  }

  const handleFocus = () => {
    // Show all available options when focusing on empty field
    if (inputValue.length === 0 && items.length > 0) {
      setOpen(true)
    }
  }

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue)
    onValueChange?.(selectedValue)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleFocus}
              placeholder={placeholder}
              className="pr-8"
            />
            {(inputValue.length >= minCharsToShow || inputValue.length === 0) && items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2"
                onClick={() => setOpen(!open)}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-72 overflow-hidden p-0 z-50 bg-popover" align="start">
          <Command>
            <CommandList>
              {filteredItems.length === 0 ? (
                <CommandEmpty>{emptyText}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredItems.map((item) => (
                    <CommandItem
                      key={item}
                      value={item}
                      onSelect={() => handleSelect(item)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          inputValue === item ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {item}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}