import type { Icon } from '@phosphor-icons/react';
import {
  MagnifyingGlass,
  FileText,
  Package,
  Eye,
  ChatCircle,
  Brain,
  GitFork,
  CheckCircle,
  FilePlus,
  PencilSimple,
  ArrowsClockwise,
  FloppyDisk,
  Flask,
  Hammer,
  MagicWand,
  Bug,
  Check,
  Shield,
  ShieldWarning,
  ShieldCheck,
  User,
} from '@phosphor-icons/react';

export const USER_ICON = User;

export const EVENT_TYPE_ICONS: Record<string, Icon> = {
  // exploration
  code_search: MagnifyingGlass,
  doc_read: FileText,
  dependency_check: Package,
  file_read: Eye,
  query: ChatCircle,
  // planning
  task_analysis: Brain,
  approach_decision: GitFork,
  task_complete: CheckCircle,
  // implementation
  code_create: FilePlus,
  code_modify: PencilSimple,
  refactor: ArrowsClockwise,
  file_write: FloppyDisk,
  // verification
  test_run: Flask,
  build_run: Hammer,
  lint_run: MagicWand,
  // debugging
  error_encountered: Bug,
  error_resolved: Check,
  // rule_compliance
  rule_match: Shield,
  violation_found: ShieldWarning,
  fix_applied: ShieldCheck,
};
