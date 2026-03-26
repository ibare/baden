import { useParams } from 'react-router-dom';

/** URL param에서 projectId를 추출. 홈(`/`)에서는 빈 문자열 반환. */
export function useSelectedProject(): string {
  const { projectId } = useParams<{ projectId: string }>();
  return projectId ?? '';
}
