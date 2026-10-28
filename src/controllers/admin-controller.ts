import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AdminModel } from '../models/admin.ts';
import { requireAdmin } from '../models/admin.ts';
import type { AuthUser } from '../models/user.ts';
import { ValidationError } from '../models/project.ts';
import { html, readForm } from './project-controller.ts';
import { adminView } from '../views/admin.ts';
export async function adminController(req: IncomingMessage, res: ServerResponse, url: URL, model: AdminModel, user: AuthUser, token: string) {
  requireAdmin(user);
  if (req.method === 'GET' && ['/admin', '/admin/'].includes(url.pathname)) {
    html(res, adminView(await model.list(), token, url.searchParams.has('saved') ? 'Catálogo actualizado.' : '')); return;
  }
  if (req.method === 'POST' && url.pathname === '/admin/catalogs') {
    try {
      const fields = await readForm(req);
      if (fields.get('csrf') !== token) { html(res, 'Formulario caducado.', 403); return; }
      await model.save(fields);
      res.writeHead(303, { Location: '/admin?saved=1' }); res.end();
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      html(res, adminView(await model.list(), token, error.message, true), 422);
    }
    return;
  }
  html(res, 'Página no encontrada', 404);
}
