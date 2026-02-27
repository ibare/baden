import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useProject } from '@/hooks/useProjectContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { RootOutletContext } from '@/components/layout/RootLayout';
import { ActionRegistryPanel } from '@/components/domain/ActionRegistryPanel';

export function ActionRegistryPage() {
  const { selectedProject } = useProject();
  const { prefixes, keywords, refreshRegistry, setConnected } =
    useOutletContext<RootOutletContext>();

  const { connected } = useWebSocket({
    projectId: selectedProject || undefined,
    onRegistryUpdate: refreshRegistry,
  });

  useEffect(() => {
    setConnected(connected);
  }, [connected, setConnected]);

  if (!selectedProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Select a project first
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ActionRegistryPanel
        projectId={selectedProject}
        prefixes={prefixes}
        keywords={keywords}
        onRefresh={refreshRegistry}
      />
    </div>
  );
}
