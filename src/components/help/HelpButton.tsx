import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpButtonProps {
  topic: string;
  tooltip?: string;
  placement?: 'inline' | 'corner';
  onClick?: () => void;
}

export function HelpButton({ topic, tooltip, placement = 'inline', onClick }: HelpButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default: open help panel with topic
      const event = new CustomEvent('open-help', { detail: { topic } });
      window.dispatchEvent(event);
    }
  };

  const buttonClasses = placement === 'corner' 
    ? 'absolute top-2 right-2' 
    : 'inline-flex';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 text-muted-foreground hover:text-foreground ${buttonClasses}`}
          onClick={handleClick}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="sr-only">Help: {topic}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip || 'Click for help'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
