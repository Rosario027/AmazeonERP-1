import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface MaskedNumberProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  className?: string;
}

export function MaskedNumber({
  value,
  prefix = "",
  suffix = "",
  isCurrency = false,
  className = "",
}: MaskedNumberProps) {
  const [isMasked, setIsMasked] = useState(true);

  const formattedValue = typeof value === "number" 
    ? (isCurrency ? `₹${value.toFixed(2)}` : value.toLocaleString())
    : value;

  const maskedValue = "••••••";

  const toggleMask = () => {
    setIsMasked(!isMasked);
  };

  return (
    <div 
      className={`inline-flex items-center gap-1 cursor-pointer select-none hover:opacity-80 transition-opacity ${className}`}
      onClick={toggleMask}
      title={isMasked ? "Click to reveal" : "Click to hide"}
    >
      <span>{prefix}{isMasked ? maskedValue : formattedValue}{suffix}</span>
      {isMasked ? (
        <Eye className="h-4 w-4 text-muted-foreground/50" />
      ) : (
        <EyeOff className="h-4 w-4 text-muted-foreground/50" />
      )}
    </div>
  );
}
