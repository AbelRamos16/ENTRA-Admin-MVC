import type { AuthUser } from './user.ts';
import { ValidationError } from './project.ts';
import { CatalogModel } from './catalog.ts';
export function requireAdmin(user: AuthUser) {
  if (user.role !== 'superadmin') throw new ValidationError('Acceso exclusivo del administrador.');
}
export class AdminModel extends CatalogModel {}
