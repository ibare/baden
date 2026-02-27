import { List } from '@phosphor-icons/react';

interface TopBarProps {
  connected: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TopBar({ connected, sidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-11 px-4 border-b border-border bg-card/80 backdrop-blur flex-shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <List size={18} weight="bold" />
        </button>
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          <span className="text-primary">B</span>aden
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
}
