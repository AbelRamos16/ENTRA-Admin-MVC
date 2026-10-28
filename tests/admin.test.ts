import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
import { AdminModel, requireAdmin, validateAssignment } from '../src/models/admin.ts';
import { UserModel } from '../src/models/user.ts';
import { ProjectModel, validateProject } from '../src/models/project.ts';
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const admin = { id: first, username: 'admin', role: 'superadmin' };
test('Validación backend: artista, motivo, rol y campos sensibles', () => {
  assert.throws(() => requireAdmin({ ...admin, role: 'artist' }));
  assert.throws(() => validateAssignment(new URLSearchParams({ artistId: 'inventado', expectedOwner: first, reason: 'Cambio válido' })));
  assert.throws(() => validateAssignment(new URLSearchParams({ artistId: second, expectedOwner: first, reason: 'x' })));
  assert.throws(() => validateAssignment(new URLSearchParams({ artistId: first, expectedOwner: first, reason: 'Cambio válido' })));
  assert.equal(validateAssignment(new URLSearchParams({ artistId: second, expectedOwner: first, reason: 'Cambio válido' })).artistId, second);
  assert.throws(() => validateProject(new URLSearchParams({ title:'Demo',genre:'Indie',bpm:'999',musicalKey:'La menor',need:'Una voz',status:'Borrador' })));
});
test('Express: acceso, CSRF y dropdown con perfiles; guardado solo autorizado', async () => {
  let assignments = 0;
  const userModel = { getSession: async (id: string) => id === 'admin' || id === 'artist' ? { id, userId:first, username:id, role:id === 'admin' ? 'superadmin':'artist', csrfToken:'valid-token' } : undefined } as unknown as UserModel;
  const adminModel = {
    dashboard: async () => ({projects:[{id:1,title:'Demo <segura>',owner_id:first,status:'Borrador'}], artists:[{id:first,username:'uno',display_name:null},{id:second,username:'dos',display_name:null}],history:[]}),
    assign: async (_user: unknown, _id: number, fields: URLSearchParams) => { validateAssignment(fields); assignments++; },
  } as unknown as AdminModel;
  const { server } = createApp({ userModel, adminModel, model:{} as ProjectModel });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address=server.address(); assert.ok(address && typeof address !== 'string');
  const base=`http://127.0.0.1:${address.port}`;
  const request=(path:string,cookie='',body?:URLSearchParams) => fetch(base+path,{headers:{Cookie:`entra_session=${cookie}`},method:body?'POST':'GET',body,redirect:'manual'});
  try {
    assert.equal((await request('/health')).status,200);
    assert.equal((await request('/admin')).status,303);
    assert.equal((await request('/admin','artist')).status,403);
    const page=await (await request('/admin','admin')).text();
    assert.match(page,/<select name="artistId" required>/); assert.match(page,/dos/); assert.match(page,/Demo &lt;segura&gt;/);
    const fields={artistId:second,expectedOwner:first,reason:'Corrección válida'};
    assert.equal((await request('/admin/projects/1/assign','admin',new URLSearchParams({...fields,csrf:'bad'}))).status,403);
    assert.equal(assignments,0);
    assert.equal((await request('/admin/projects/1/assign','admin',new URLSearchParams({...fields,reason:'x',csrf:'valid-token'}))).status,422);
    assert.equal(assignments,0);
    assert.equal((await request('/admin/projects/1/assign','admin',new URLSearchParams({...fields,csrf:'valid-token'}))).status,303);
    assert.equal(assignments,1);
  } finally { await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve())); }
});
test('El backend rechaza un hook fuera del audio aunque se omita HTML/JS', async () => {
  let writes = 0;
  const project = { id:1, ownerId:first, title:'Demo', genre:'Indie', bpm:120, musicalKey:'La menor', need:'Una voz', description:'', status:'Borrador', audioDuration:60, audioName:'demo.mp3', hookStart:10, hookEnd:20, updatedAt:'' };
  const model = { find:async()=>project, update:async()=>{ writes++; return true; } } as unknown as ProjectModel;
  const userModel = {getSession:async()=>({id:'artist',userId:first,username:'artista',role:'artist',csrfToken:'token'})} as unknown as UserModel;
  const {server}=createApp({model,userModel});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address && typeof address !== 'string');
  try {
    const result=await fetch(`http://127.0.0.1:${address.port}/projects/1/edit`,{method:'POST',headers:{Cookie:'entra_session=artist'},body:new URLSearchParams({title:'Demo',genre:'Indie',bpm:'120',musicalKey:'La menor',need:'Una voz',description:'',status:'Borrador',csrf:'token',hookStart:'10',hookEnd:'90'}),redirect:'manual'});
    assert.equal(result.status,422);assert.equal(writes,0);assert.match(await result.text(),/hook válido/);
  } finally {await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
});
