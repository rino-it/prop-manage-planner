import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type UserOption = {
  id: string;
  label: string;
};

interface MultiSelectProps {
  options: UserOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function UserMultiSelect({ options, selected, onChange, placeholder = "Seleziona utenti..." }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (currentId: string) => {
    if (selected.includes(currentId)) {
      onChange(selected.filter((id) => id !== currentId));
    } else {
      onChange([...selected, currentId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-[40px] py-2"
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && <span className="text-muted-foreground font-normal">{placeholder}</span>}
            {selected.map((id) => {
              const user = options.find((op) => op.id === id);
              return (
                <Badge key={id} variant="secondary" className="mr-1">
                  {user?.label || id}
                </Badge>
              );
            })}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Cerca utente..." />
          <CommandList>
            <CommandEmpty>Nessun utente trovato.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => handleSelect(option.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(option.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}