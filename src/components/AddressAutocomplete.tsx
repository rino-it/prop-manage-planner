import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { debouncedAutocomplete, isGeocodingConfigured, type AutocompleteResult } from '@/utils/geocoding';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onSelect?: (result: AutocompleteResult) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Via Roma 1, Milano",
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const configured = isGeocodingConfigured();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(newValue: string) {
    onChange(newValue);

    if (!configured || newValue.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    if (cancelRef.current) cancelRef.current();

    cancelRef.current = debouncedAutocomplete(newValue, (results) => {
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
    });
  }

  function handleSelect(result: AutocompleteResult) {
    onChange(result.display_name);
    setIsOpen(false);
    setSuggestions([]);
    onSelect?.(result);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
        />
        {configured && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4 text-slate-400" />
            )}
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((result) => (
            <button
              key={result.place_id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-start gap-2 border-b last:border-b-0"
              onClick={() => handleSelect(result)}
            >
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{result.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
