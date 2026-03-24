import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { validateCodiceFiscale, formatCodiceFiscale, type CodiceFiscaleValidation } from '@/utils/codiceFiscale';

interface CodiceFiscaleInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation?: (result: CodiceFiscaleValidation) => void;
  className?: string;
  placeholder?: string;
}

export function CodiceFiscaleInput({
  value,
  onChange,
  onValidation,
  className,
  placeholder = "RSSMRA85M01H501Z",
}: CodiceFiscaleInputProps) {
  const [validation, setValidation] = useState<CodiceFiscaleValidation | null>(null);
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCodiceFiscale(e.target.value);
      const limited = formatted.substring(0, 16);
      onChange(limited);

      if (limited.length === 16) {
        const result = validateCodiceFiscale(limited);
        setValidation(result);
        onValidation?.(result);
      } else {
        setValidation(null);
      }
    },
    [onChange, onValidation]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (value.length === 16) {
      const result = validateCodiceFiscale(value);
      setValidation(result);
      onValidation?.(result);
    }
  }, [value, onValidation]);

  const showStatus = touched || value.length === 16;

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`uppercase tracking-wider font-mono ${className || ''} ${
            showStatus && validation
              ? validation.valid
                ? 'border-green-400 focus-visible:ring-green-400'
                : 'border-red-400 focus-visible:ring-red-400'
              : ''
          }`}
          maxLength={16}
        />
        {showStatus && validation && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {validation.valid ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        )}
      </div>

      {showStatus && validation && !validation.valid && (
        <div className="flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{validation.errors[0]}</span>
        </div>
      )}

      {showStatus && validation?.valid && validation.parsed && (
        <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
          Genere: {validation.parsed.gender === 'M' ? 'Maschio' : 'Femmina'} |
          Nato il: {validation.parsed.birthDay}/{validation.parsed.birthMonth}/
          {parseInt(validation.parsed.birthYear) > 50 ? '19' : '20'}{validation.parsed.birthYear}
        </div>
      )}
    </div>
  );
}
