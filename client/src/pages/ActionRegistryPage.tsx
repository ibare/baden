import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { RootOutletContext } from '@/components/layout/RootLayout';
import { ActionRegistryPanel } from '@/components/domain/ActionRegistryPanel';

export function ActionRegistryPage() {
  const selectedProject = useSelectedProject();
  const { prefixes, keywords, refreshRegistry, setConnected } =
    useOutletContext<RootOutletContext>();

  const { connected } = useWebSocket({
    projectId: selectedProject || undefined,
    onRegistryUpdate: refreshRegistry,
  });

  useEffect(() => {
    setConnected(connected);
  }, [connected, setConnected]);

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
