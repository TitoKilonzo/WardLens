import { titleCase } from '../../../utils/format';
import type { ProjectStatus } from '../../../types';
export function StatusPill({ status }: { status: ProjectStatus | string }) {
  return <span className={`status-pill status-${status.replaceAll('_','-')}`}><span className="status-dot" />{titleCase(status)}</span>;
}
