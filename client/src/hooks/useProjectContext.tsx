import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Project } from '@/lib/api';

interface ProjectContextValue {
  projects: Project[];
  selectedProject: string;
  setSelectedProject: (id: string) => void;
  addProject: (project: Project) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProjectRaw] = useState<string>(
    () => sessionStorage.getItem('baden_selected_project') ?? '',
  );

  useEffect(() => {
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  const setSelectedProject = useCallback((id: string) => {
    setSelectedProjectRaw(id);
    if (id) {
      sessionStorage.setItem('baden_selected_project', id);
    } else {
      sessionStorage.removeItem('baden_selected_project');
    }
  }, []);

  const addProject = useCallback((project: Project) => {
    setProjects((prev) => [...prev, project]);
  }, []);

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, setSelectedProject, addProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
