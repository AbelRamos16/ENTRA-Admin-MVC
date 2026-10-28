# ENTRA · Administración MVC

ENTRA organiza proyectos musicales y el fragmento de audio donde se necesita colaboración. Esta entrega utiliza **TypeScript, Express 5 sobre Node.js 24 y Supabase**.

## Funcionalidades

- Registro con usuario, email y contraseña; Login y cierre de sesión POST con CSRF.
- Artistas: CRUD, lectura separada, demo MP3 de hasta 10 MB y selección visual del hook.
- Superadmin: consulta todos los proyectos y reasigna su artista responsable en `/admin`.
- El artista se elige desde un dropdown cargado de `profiles`; nunca se escribe manualmente su ID.
- Motivo obligatorio de 5–300 caracteres, comprobación backend del rol y destino, y detección de formularios desactualizados.
- Reasignación e historial en una única transacción SQL. El artista anterior pierde acceso y el nuevo lo obtiene.

## Instalación

Requiere Node >=24.16.0 <25. Dentro del repositorio:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Completar `.env` con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY`. No compartir ni versionar claves. `PORT` predeterminado 3000; `HOST` predeterminado 127.0.0.1. La aplicación carga `.env` mediante dotenv.

**Base existente de Julián:** deben existir Supabase Auth, `profiles`, `projects`, `app_sessions` y el trigger que genera perfiles al registrar usuarios. Este cambio no migra los datos antiguos de SQLite ni crea el esquema previo.

Ejecutar en SQL Editor de Supabase `supabase/migrations/20261028_admin_assignments.sql`. Añade la tabla `entra_project_assignments` y la función transaccional `entra_assign_project`. No altera registros ni concede roles a cuentas. La pantalla administrativa necesita esta migración.

El grupo debe disponer de una cuenta cuyo `profiles.role` sea `superadmin`. El registro público no permite elegir ese rol. El responsable de Supabase debe configurar la cuenta administrativa que acuerden.

## Arquitectura

- `src/server.ts`: aplicación Express, estáticos, rutas públicas, middleware de sesión, autorización administrativa y tratamiento de errores.
- `src/controllers/`: controladores de autenticación, proyectos y administración.
- `src/models/`: persistencia Supabase y reglas de validación.
- `src/views/`: HTML renderizado por servidor y componentes compartidos.
- `src/client/`: onboarding, requisitos de contraseña y onda real del MP3.
- `public/`: recursos gráficos, fuentes locales y estilos BEM.
- `supabase/migrations/`: migración administrativa.

Se mantiene `createServer(app)` para compatibilidad de las pruebas y el transporte HTTP; Express procesa las solicitudes. Node.js sigue siendo el runtime. Los controladores leen los formularios y multipart con límites; no hay un parser global que consuma el audio antes de validar.

KISS: una aplicación Express y formularios HTML. DRY: layout, formulario compartido, validación de asignación centralizada. BEM: `admin-panel__project`, `admin-panel__form`, `project-card__body`. MVC separa rutas, acceso a datos y presentación.

## Validaciones del core

El servidor valida título, género, estado, BPM entero 40–240 y tonalidad obligatoria. El MP3 se inspecciona con music-metadata. Si hay audio, el hook debe cumplir `0 <= inicio < fin <= duración real`. No basta alterar atributos HTML para saltarse la validación.

La reasignación valida sesión, rol superadmin, CSRF, formato del ID, motivo y artista distinto. La función SQL vuelve a consultar que actor sea superadmin y destino sea una cuenta artista registrada; bloquea el proyecto y compara su autoría con el formulario. Solo guarda la modificación si también puede insertar el historial. La función solo es ejecutable con service_role en backend; anon y authenticated no pueden invocarla directamente.

## Pruebas

```powershell
npm run typecheck
npm run test:local
npm test
```

`test:local` ejecuta `tests/admin.test.ts` con modelos sustitutos: no toca Supabase. Necesita variables con formato válido para cargar la configuración, pero admite valores ficticios. Verifica middleware Express, sesión, permisos, CSRF, selector, escape HTML, motivo y validación de BPM.

`npm test` incluye las pruebas de integración heredadas que crean usuarios y proyectos temporales en el Supabase configurado. Ejecutarlas en un proyecto de prueba, no sobre datos de presentación. La migración administrativa y su transacción deben verificarse también contra Supabase antes del video.

## Despliegue en Render

El repositorio incluye `render.yaml`. Conectar el repositorio a Render como Web Service o Blueprint y configurar las tres variables Supabase en el panel, sin pegarlas en Git. Configuración: Node 24.16.0, build `npm ci`, start `npm start`, `HOST=0.0.0.0`, `NODE_ENV=production`. Render suministra `PORT`. Health check `/health` confirma el proceso, no la conexión a la base.

Guía oficial: https://render.com/docs/deploy-node-express-app

**URL pública:** pendiente de publicar. No se considera desplegado por arrancar en localhost. Tras publicar, comprobar registro, Login, audio, administración y permisos en la URL HTTPS.

## Video de la entrega

1. Abrir URL pública y mostrar acceso bloqueado sin sesión.
2. Login de administrador y pantalla `/admin` con proyectos.
3. Mostrar el dropdown de artistas, cambiar responsable con un motivo y consultar historial.
4. Mostrar en el código la validación backend y el control transaccional SQL.
5. Demostrar rechazo de un dato inválido (hook fuera de duración o artista inexistente mediante una prueba, no solo validación del navegador).
6. Mostrar cuenta de artista sin acceso administrativo, repositorio y README.

## Estado de esta implementación

Express y administración implementados. TypeScript y pruebas locales verificados. Migración SQL suministrada para aplicar en el Supabase del grupo; ejecución real de la función y despliegue público pendientes. Las claves no se incluyen.

Integrantes: Abel Ramos y Julián Pacheco.
