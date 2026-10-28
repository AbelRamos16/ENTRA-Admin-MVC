import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
import { AdminModel, requireAdmin } from '../src/models/admin.ts';
import { CatalogModel, resolveSelection, validateCatalog } from '../src/models/catalog.ts';
import type { CatalogItem } from '../src/models/catalog.ts';
import { UserModel } from '../src/models/user.ts';
import { ProjectModel } from '../src/models/project.ts';
import type { ProjectInput } from '../src/models/project.ts';
const items: CatalogItem[] = [
 {id:1,kind:'genre',name:'Jazz',parent_id:null,active:true},
 {id:2,kind:'instrument',name:'Voz',parent_id:null,active:true},
 {id:3,kind:'instrument',name:'Bajo',parent_id:null,active:true},
 {id:4,kind:'collaboration',name:'Coro',parent_id:2,active:true},
 {id:5,kind:'collaboration',name:'Línea de bajo',parent_id:3,active:true},
 {id:6,kind:'genre',name:'Inactivo',parent_id:null,active:false},
];
const catalogs = {list:async()=>items} as CatalogModel;
const userModel = {getSession:async(id:string)=> ['admin','artist'].includes(id) ? {id,userId:'11111111-1111-4111-8111-111111111111',username:id,role:id==='admin'?'superadmin':'artist',csrfToken:'token'} : undefined} as unknown as UserModel;
const selection = {genreId:'1',instrumentId:'2',collaborationId:'4'};
async function withServer(deps: Parameters<typeof createApp>[0], run:(base:string)=>Promise<void>) {
 const {server}=createApp({userModel,catalogModel:catalogs,...deps});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address && typeof address!=='string');
 try {await run(`http://127.0.0.1:${address.port}`);} finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
const request=(base:string,path:string,role='admin',fields?:Record<string,string>)=>fetch(base+path,{method:fields?'POST':'GET',headers:{Cookie:`entra_session=${role}`},body:fields?new URLSearchParams(fields):undefined,redirect:'manual'});
test('Backend rechaza referencias inventadas, inactivas y colaboración de otro instrumento',()=>{
 assert.throws(()=>requireAdmin({id:'x',username:'x',role:'artist'}));
 assert.throws(()=>validateCatalog(new URLSearchParams({kind:'genre',name:'<script>'})));
 assert.throws(()=>validateCatalog(new URLSearchParams({kind:'collaboration',name:'Coro',parentId:'inventado'})));
 assert.equal(validateCatalog(new URLSearchParams({kind:'genre',name:'  Jazz  fusión '})).name,'Jazz fusión');
 assert.throws(()=>resolveSelection(items,new URLSearchParams({...selection,genreId:'999'})));
 assert.throws(()=>resolveSelection(items,new URLSearchParams({...selection,genreId:'6'})));
 assert.throws(()=>resolveSelection(items,new URLSearchParams({...selection,instrumentId:'3'})));
 assert.equal(resolveSelection(items,new URLSearchParams(selection)).collaboration.name,'Coro');
});
test('Administración: sesión, rol, CSRF, selector relacionado, creación y actualización',async()=>{
 const writes:URLSearchParams[]=[];
 const adminModel={list:async()=>items,save:async(fields:URLSearchParams)=>{validateCatalog(fields);writes.push(fields);}} as unknown as AdminModel;
 await withServer({adminModel},async base=>{
  assert.equal((await request(base,'/admin','')).status,303);
  assert.equal((await request(base,'/admin','artist')).status,403);
  const page=await(await request(base,'/admin')).text();
  assert.match(page,/<select name="parentId" required>/);
  assert.match(page,/Tipos de colaboración/);assert.doesNotMatch(page,/Guardar asignación/);
  const fields={csrf:'token',kind:'collaboration',name:'Puente',parentId:'2'};
  assert.equal((await request(base,'/admin/catalogs','admin',{...fields,csrf:'bad'})).status,403);
  assert.equal(writes.length,0);
  assert.equal((await request(base,'/admin/catalogs','admin',{...fields,name:'x'})).status,422);
  assert.equal(writes.length,0);
  assert.equal((await request(base,'/admin/catalogs','admin',fields)).status,303);
  assert.equal((await request(base,'/admin/catalogs','admin',{...fields,id:'4',active:'false'})).status,303);
  assert.equal(writes.length,2);
 });
});
test('CRUD usa catálogos, conserva selección y rechaza manipulación antes de escribir',async()=>{
 const writes:ProjectInput[]=[];
 const model={create:async(input:ProjectInput)=>{writes.push(input);return 1;}} as unknown as ProjectModel;
 await withServer({model},async base=>{
  const page=await(await request(base,'/projects/new','artist')).text();
  assert.match(page,/name="genreId"/);assert.match(page,/data-parent="2"/);assert.doesNotMatch(page,/>Inactivo</);
  const fields={...selection,title:'Demo jazz',bpm:'120',musicalKey:'La menor',status:'Borrador',csrf:'token',genre:'Falso',need:'Texto manipulado'};
  const invalid=await request(base,'/projects','artist',{...fields,instrumentId:'3'});
  assert.equal(invalid.status,422);assert.equal(writes.length,0);
  assert.match(await invalid.text(),/value="3"[^>]*selected/);
  assert.equal((await request(base,'/projects','artist',{...fields,bpm:'999'})).status,422);
  assert.equal(writes.length,0);
  assert.equal((await request(base,'/projects','artist',fields)).status,303);
  assert.equal(writes[0].genre,'Jazz');assert.equal(writes[0].need,'Coro · Voz');
  assert.equal(writes[0].collaborationId,4);
 });
});
test('Hook fuera de la duración real se rechaza sin guardar',async()=>{
 let writes=0;
 const project={id:1,genreId:1,instrumentId:2,collaborationId:4,title:'Demo',genre:'Jazz',bpm:120,musicalKey:'La menor',need:'Coro',description:'',status:'Borrador',audioDuration:60,audioName:'demo.mp3',hookStart:10,hookEnd:20};
 const model={find:async()=>project,update:async()=>{writes++;return true;}} as unknown as ProjectModel;
 await withServer({model},async base=>{
  const response=await request(base,'/projects/1/edit','artist',{...selection,title:'Demo',bpm:'120',musicalKey:'La menor',status:'Borrador',csrf:'token',hookStart:'10',hookEnd:'90'});
  assert.equal(response.status,422);assert.match(await response.text(),/hook válido/);assert.equal(writes,0);
 });
});
