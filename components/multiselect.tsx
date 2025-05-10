'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Option = {
  label: string;
  value: string;
};

interface MultiSelectProps {
  options: Option[];
  value?: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value = [],
  onChange,
  placeholder = 'Select...',
}) => {
  const toggleOption = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const displayLabel =
    value.length > 0
      ? options
          .filter((opt) => value.includes(opt.value))
          .map((opt) => opt.label)
          .join(', ')
      : placeholder;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className={value.length === 0 ? 'text-muted-foreground' : ''}>
            {displayLabel}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align="start"
        className="z-50 w-[250px] rounded-md border bg-popover text-popover-foreground p-2 shadow-md"
      >
        <div className='flex flex-col gap-y-1'>
            {options.map((option) => {
            const selected = value.includes(option.value);
            return (
                <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={cn(
                    'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    selected && 'bg-accent text-accent-foreground font-medium'
                )}
                >
                <Check
                    className={cn(
                    'mr-2 h-4 w-4',
                    selected ? 'opacity-100' : 'opacity-0'
                    )}
                />
                {option.label}
                </div>
            );
            })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
