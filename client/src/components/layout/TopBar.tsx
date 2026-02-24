interface TopBarProps {
  connected: boolean;
}

export function TopBar({ connected }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-11 px-4 border-b border-border bg-card/80 backdrop-blur flex-shrink-0">
      <h1 className="text-lg font-bold text-foreground tracking-tight">
        <span className="text-primary">B</span>aden
      </h1>
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? '연결됨' : '연결 끊김'}
        </span>
      </div>
    </header>
  );
}
