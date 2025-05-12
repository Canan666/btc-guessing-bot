// @/components/ui/radio-group.tsx

import React, { createContext, useContext, ReactNode } from "react";

interface RadioGroupContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null);

interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}) => {
  const selectedValue = value ?? defaultValue ?? "";
  return (
    <RadioGroupContext.Provider value={{ value: selectedValue, onValueChange }}>
      <div className={className}>{children}</div>
    </RadioGroupContext.Provider>
  );
};

interface RadioGroupItemProps {
  value: string;
  children: ReactNode;
}

export const RadioGroupItem: React.FC<RadioGroupItemProps> = ({ value, children }) => {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioGroupItem must be used within a RadioGroup");
  }

  const { value: selectedValue, onValueChange } = context;

  return (
    <label className="inline-flex items-center space-x-2 cursor-pointer">
      <input
        type="radio"
        name="radio-group"
        value={value}
        checked={selectedValue === value}
        onChange={() => onValueChange(value)}
        className="form-radio text-blue-600"
      />
      <span>{children}</span>
    </label>
  );
};
