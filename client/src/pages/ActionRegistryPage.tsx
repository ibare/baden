import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useProject } from '@/hooks/useProjectContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { RootOutletContext } from '@/components/layout/RootLayout';
import { ActionRegistryPanel } from '@/components/domain/ActionRegistryPanel';

export function ActionRegistryPage() {
  const { selectedProject } = useProject();
  const { prefixes, refreshRegistry, setConnected } =
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
        프로젝트를 먼저 선택하세요
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ActionRegistryPanel
        projectId={selectedProject}
        prefixes={prefixes}
        onRefresh={refreshRegistry}
      />
    </div>
  );
}
