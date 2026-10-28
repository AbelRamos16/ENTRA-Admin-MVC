# ENTRA · Administración MVC

ENTRA conecta ideas musicales con lo que les falta para avanzar. Los artistas organizan proyectos, adjuntan una demo y marcan el hook donde necesitan colaboración.

**TypeScript · Express 5 · Node.js 24 · Supabase**

## Aplicación publicada

[ENTRA](https://entra-admin-mvc-i5c1.vercel.app/login)

La URL corresponde al proyecto de producción. Los cambios locales requieren push y despliegue para aparecer allí.

## Qué hace esta entrega

- Registro, Login, cierre de sesión y rutas protegidas.
- CRUD de proyectos con lectura separada, demo MP3 y selección visual del hook.
- Administración exclusiva para cuentas con `profiles.role = 'superadmin'`.
- Secciones administrativas **Catálogos · Artistas · Proyectos** con navegación compartida.
- Artistas: búsqueda por usuario/nombre, edición de nombre artístico y biografía (hasta 500 caracteres), y consulta de sus proyectos.
- Proyectos: filtro por artista, lectura con demo/hook, edición y eliminación con confirmación. Guardar, cancelar o conservar devuelve a la lista administrativa. Se reutiliza el CRUD y se mantiene la autoría.
- Catálogos de géneros, instrumentos y tipos de colaboración: crear, consultar, editar y desactivar/reactivar.
- El artista elige género e instrumento desde la base. Al cambiar de instrumento, el selector de colaboración muestra solo las opciones relacionadas: Voz → Coro / Verso; Bajo → Línea de bajo.
- Desactivar una opción la retira de nuevos formularios; conserva los proyectos existentes. Para editar un proyecto con opciones desactivadas se seleccionan opciones activas.
- La administración ya no transfiere proyectos ni solicita un motivo. La migración conserva los datos del historial anterior y retira el permiso de ejecución de la función de reasignación. No revierte transferencias realizadas.

## Preparación de Supabase: antes de desplegar

Se utiliza la base existente del grupo: Supabase Auth, `profiles`, `projects`, `app_sessions` y el trigger de creación del perfil deben existir.

1. Abrir `supabase/migrations/20261028_music_catalogs.sql`.
2. Copiar el archivo completo en Supabase → SQL Editor y ejecutarlo.
3. Ejecutar también `supabase/migrations/20261028_artist_profiles.sql`: añade `profiles.bio` y restricciones de perfil, sin cambiar credenciales, roles ni autoría.
4. La migración de catálogos crea `entra_catalog_items`, datos iniciales, claves foráneas y triggers de validación. Es transaccional y repetible. No borra proyectos.
5. Las nuevas columnas de `projects` son `genre_id`, `instrument_id` y `collaboration_id`. Los proyectos anteriores mantienen descripción, necesidad, audio, hook y artista. El género se vincula cuando hay coincidencia; los nuevos selectores se completan al editar.
6. La cuenta administrativa se configura en `profiles.role` como `superadmin`. El registro público no permite elegir ese rol.

La migración anterior `20261028_admin_assignments.sql` es histórica y no es necesaria para instalar los nuevos catálogos.

## Instalación local

Requiere Node >=24.16.0 <25.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Completar `.env` con `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable) y `SUPABASE_SERVICE_ROLE_KEY` (secret, solo servidor). Nunca versionar claves. Puerto local 3000, host 127.0.0.1.

## Arquitectura y buenas prácticas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Entrada Express | `src/server.ts` | Sesión, autorización, rutas y errores |
| Controladores | `src/controllers/` | Solicitudes, CSRF, validación y respuestas |
| Modelos | `src/models/` | Persistencia Supabase y reglas del dominio |
| Vistas | `src/views/` | HTML y formularios compartidos |
| Cliente | `src/client/` | Onda, onboarding y selectores dependientes |
| Recursos | `public/` | Logo, fuentes y estilos BEM |
| Base | `supabase/migrations/` | Esquema, relaciones y restricciones |

KISS: una aplicación Express con formularios HTML. DRY: un modelo de catálogos y un componente de formulario para los tres tipos; `resolveSelection` centraliza la validación de relaciones. BEM: `catalog-panel__form`, `catalog-panel__heading`, `project-card__body`. MVC separa presentación, solicitudes y persistencia.

Node.js sigue siendo el runtime; Express procesa las solicitudes. Los controladores leen streams con límites para no consumir el MP3 con un parser global.

## Validación backend y relaciones

- BPM entero de 40 a 240, título, tonalidad y estado comprobados antes de guardar.
- MP3 inspeccionado con music-metadata; hook dentro de la duración real: `0 <= inicio < fin <= duración`.
- Nombres de catálogo de 2–60 caracteres, sin etiquetas/caracteres de control y sin duplicados en el mismo tipo e instrumento.
- El servidor consulta la base para validar que los IDs existan, estén activos y sean del tipo correcto. Coro + Bajo se rechaza incluso manipulando el HTML o enviando POST manual.
- El tipo de colaboración referencia a su instrumento mediante `parent_id`. Los proyectos referencian las opciones mediante claves foráneas.
- PostgreSQL repite la comprobación de tipo, actividad y relación mediante triggers y sincroniza los textos de género/necesidad al guardar. Una colaboración utilizada no puede moverse a otro instrumento.
- Perfil: nombre artístico de 2–60 caracteres y biografía de hasta 500; el modelo solo actualiza `display_name` y `bio`. Los campos extra enviados por un formulario no cambian usuario, contraseña, email ni rol.
- Catálogos con RLS y acceso de escritura solo desde backend. El servidor exige superadmin y CSRF para cualquier cambio administrativo.

Los textos de género/necesidad se conservan como instantánea para visualizar proyectos anteriores; las referencias nuevas son IDs reales. Renombrar el catálogo no reescribe la ficha histórica hasta que el proyecto vuelve a guardarse.

## Pruebas

```powershell
npm run typecheck
npm run test:local
```

Las siete pruebas locales usan modelos sustitutos y no modifican Supabase. Comprueban acceso, CSRF, selectores, campos manipulados, creación/actualización de catálogos, persistencia de selección y hook fuera de duración. Incluyen perfiles con campos permitidos, escape HTML, acceso denegado a artistas, reproducción parcial de audio, edición administrativa y confirmación/CSRF al eliminar. Para cargar configuración admiten variables ficticias con formato válido.

`npm test` incluye pruebas de integración que crean usuarios y proyectos temporales en el Supabase configurado. Usar una base de prueba con la migración aplicada. No se ejecutaron contra la base del grupo en esta actualización.

Las migraciones se probaron además en PostgreSQL aislado (PGlite): repetición, datos anteriores, duplicados, referencia inválida, colaboración de otro instrumento y desactivación. La migración de perfiles también se probó al repetirla, conservar usuario/rol y rechazar nombres/biografías inválidos. Pendiente aplicar y comprobar la versión nueva en Supabase/Vercel reales.

## Despliegue en Vercel

1. Ejecutar primero ambas migraciones nuevas en Supabase (catálogos y perfiles).
2. Subir los cambios al repositorio ENTRA-Admin-MVC, rama main.
3. Usar Framework Preset Express y raíz del repositorio; sin directorio de salida de frontend.
4. Configurar las tres variables Supabase para Production. Marcar la clave secreta como Secret.
5. Desplegar y comprobar Login, CRUD, administración y permisos en HTTPS.

`vercel.json` instala dependencias de desarrollo para el compilador e incluye los scripts de `src/client/`. TypeScript está fijado en 5.9.3; `rewriteRelativeImportExtensions` convierte imports .ts a .js. El servidor exporta Express por defecto.

Vercel limita el tamaño de las solicitudes de las funciones: el límite local de MP3 de 10 MB no implica que la plataforma lo admita. Para archivos mayores a su límite se necesita subida directa a Storage o un servidor adecuado.

También se conserva `render.yaml` como alternativa de servidor. No se requieren ambos despliegues.

## Demostración para la entrega

1. Abrir la URL pública y mostrar que sin sesión no se accede a proyectos ni administración.
2. Entrar como administrador; crear un género y un instrumento.
3. Crear una colaboración eligiendo el instrumento desde un dropdown.
4. Entrar como artista y crear un proyecto con esas opciones. Cambiar de instrumento y mostrar el filtrado.
5. Mostrar en el código la validación backend de BPM/hook y de referencias. Una cuenta artista recibe 403 en /admin.
6. Editar o desactivar una opción y explicar que no se borran proyectos.
7. Abrir Artistas, buscar un perfil, editar su nombre/biografía y revisar sus proyectos. En Proyectos, probar edición, Conservar y eliminación con una publicación de prueba.
8. Mostrar repositorio y README. Grabar y adjuntar el video solicitado.

## Integrantes

Abel Ramos y Julián Pacheco · Grupo 9 · ISWZ 3101 · NRC 5489
