import type { Project, Ward } from '../types';
export const projectPath = (project: Project) => `/projects/${project.id}/${project.slug}`;
export const wardPath = (ward: Ward) => `/wards/${ward.slug}`;
