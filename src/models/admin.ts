import { supabaseAdmin } from '../config/supabase.ts';
import type { AuthUser } from './user.ts';
import { ValidationError } from './project.ts';
export type Dashboard = {
  artists: { id: string; username: string; display_name: string | null }[];
  projects: { id: number; title: string; owner_id: string; status: string }[];
  history: { project_id: number | null; previous_owner_id: string | null; new_owner_id: string | null; reason: string; changed_at: string }[];
};
export function requireAdmin(user: AuthUser) {
  if (user.role !== 'superadmin') throw new ValidationError('Solo el administrador puede reasignar proyectos.');
}
export function validateAssignment(fields: URLSearchParams) {
  const artistId = fields.get('artistId')?.trim() ?? '';
  const expectedOwner = fields.get('expectedOwner')?.trim() ?? '';
  const reason = fields.get('reason')?.trim() ?? '';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(artistId) || !uuid.test(expectedOwner)) throw new ValidationError('Selecciona un artista válido y recarga el formulario.');
  if (reason.length < 5 || reason.length > 300) throw new ValidationError('El motivo debe tener entre 5 y 300 caracteres.');
  if (artistId === expectedOwner) throw new ValidationError('Selecciona otro artista.');
  return { artistId, expectedOwner, reason };
}
export class AdminModel {
  async dashboard(user: AuthUser): Promise<Dashboard> {
    requireAdmin(user);
    const [projects, artists, history] = await Promise.all([
      supabaseAdmin.from('projects').select('id,title,owner_id,status').order('updated_at', { ascending: false }),
      supabaseAdmin.from('profiles').select('id,username,display_name').neq('role','superadmin').order('username'),
      supabaseAdmin.from('entra_project_assignments').select('*').order('changed_at', { ascending: false }).limit(20),
    ]);
    for (const result of [projects, artists, history]) if (result.error) throw new Error(`Administración: ejecuta la migración SQL. ${result.error.message}`);
    return { projects: projects.data ?? [], artists: artists.data ?? [], history: history.data ?? [] } as Dashboard;
  }
  async assign(user: AuthUser, id: number, fields: URLSearchParams) {
    requireAdmin(user);
    if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError('Proyecto inválido.');
    const { artistId, expectedOwner, reason } = validateAssignment(fields);
    const { error } = await supabaseAdmin.rpc('entra_assign_project', {
      p_actor: user.id, p_project: id, p_artist: artistId, p_expected_owner: expectedOwner, p_reason: reason,
    });
    if (error) {
      if (['22023','42501','P0002','40001'].includes(error.code)) throw new ValidationError(error.message);
      throw new Error(`No se pudo reasignar: ${error.message}`);
    }
  }
}
