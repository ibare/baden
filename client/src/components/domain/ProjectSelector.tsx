import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Project } from "@/lib/api"

const ALL = "__all__"

interface ProjectSelectorProps {
  projects: Project[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function ProjectSelector({
  projects,
  value,
  onChange,
  placeholder = "프로젝트 선택",
  className,
}: ProjectSelectorProps) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
    >
      <SelectTrigger size="sm" className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
