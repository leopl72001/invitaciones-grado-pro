# GradoPro 🎓 — Invitaciones interactivas de graduación

Aplicación React + TypeScript + Vite para la fiesta de **Licenciatura en Matemáticas** del **18 de diciembre de 2026, a las 6:00 p. m. (hora de Colombia)**.

## Incluye

- Invitación elegante y responsiva: sobre animado, estrellas matemáticas, fotos Polaroid, confeti, desplazamientos animados, cuenta regresiva en vivo y música de hasta 30 segundos.
- Panel administrativo para **crear, editar, eliminar y filtrar invitados**, cada uno con **nombre, grupo, cupos, teléfono y enlace exclusivo**.
- Catálogo de invitaciones y botones **Copiar enlace**, **Vista previa** y **Enviar por WhatsApp**.
- Grupos de invitados (familia, amigos, etc.) y cupos sugeridos por grupo.
- Selector musical estilo Instagram: pega una URL directa de audio, escucha la vista previa y mueve el inicio de la ventana de **30 segundos**; los enlaces a páginas de YouTube/Spotify no entregan un archivo de audio utilizable.
- Tres canciones configurables: una general y **dos canciones especiales** que se asignan a dos invitaciones específicas. El sistema impide usar cada canción especial en más de una invitación.
- Formulario de **confirmación de asistencia** con validación de cupos, mensaje y opción de modificar la respuesta.
- Registro de respuestas (el panel actualiza cada 12 segundos), cantidad de asistentes y exportación CSV; ideas de regalos en dos categorías.
- **Persistencia en Supabase**, con autenticación y políticas RLS. Los enlaces individuales incluyen tokens aleatorios de 64 caracteres.
- **Modo demostración** que guarda datos solo en `localStorage` para poder probar el panel sin configurar la nube.

## Ejecutar en el computador

Necesitas Node.js 22+.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

> **Importante:** sin Supabase, las invitaciones se guardan **solamente en el navegador donde fueron creadas**. Los enlaces compartidos NO funcionarán en otros dispositivos. Antes de enviar las invitaciones reales, configura la nube y publica la aplicación.

## Activar almacenamiento en nube y confirmaciones reales

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. Abre **SQL Editor** y ejecuta íntegro `supabase/schema.sql`. Crea las tablas, políticas RLS, dos funciones de invitado y el bucket público de fotografías/música.
3. Abre **Authentication → Providers → Email**. Activa correo y contraseña. Si quieres registro inmediato en las pruebas, configura la confirmación por email según tus necesidades.
4. Abre **Project Settings → API** y copia `Project URL` y la **anon / publishable key**. **Nunca uses la clave service_role** en esta aplicación.
5. En el proyecto, copia `.env.example` a `.env` y escribe:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
   ```

6. Reinicia `npm run dev`, crea una cuenta desde el panel e inicia sesión. La primera vez se creará tu evento.
7. En **Personalización**, agrega nombre, dirección, Google Maps, fotos y 3 clips musicales. Pulsa **Guardar cambios**.
8. Crea grupos, registra invitados, establece cupos y asigna la canción especial solo a las 2 invitaciones que quieras.

### Sobre fotos y música

Se pueden pegar URLs públicas HTTPS o subir archivos al bucket `invitation-assets` con el botón **Subir** (requiere iniciar sesión en Supabase). Las fotografías y los clips subidos serán **públicos para quien conozca su URL**, no incluyas archivos privados. Para los audios usa material propio o autorizado; la app limita la reproducción a 30 segundos, pero eso no sustituye los permisos de uso.

Los navegadores móviles normalmente **no permiten reproducir audio automáticamente**. La invitación ofrece un botón Play; el sonido empieza cuando el invitado lo toca.

## Publicar en GitHub Pages

1. Entra a [github.com/new](https://github.com/new) y crea un repositorio llamado `invitaciones-grado-pro` (**público** si vas a usar GitHub Pages gratuito; el código no incluye tus datos privados). **No añadas README al crearlo**, porque ya existe uno aquí.
2. En esta carpeta, ejecuta:

   ```bash
   git init
   git add .
   git commit -m "Primera versión de GradoPro"
   git branch -M main
   git remote add origin https://github.com/leopl72001/invitaciones-grado-pro.git
   git push -u origin main
   ```

3. En el repositorio, ve a **Settings → Secrets and variables → Actions → Variables** y crea estas **repository variables** (son valores públicos en la web compilada):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Ve a **Settings → Pages → Build and deployment**, selecciona **GitHub Actions** como fuente.
5. En **Actions**, abre el workflow `Publicar invitaciones en GitHub Pages` y ejecútalo (o haz un nuevo push a `main`). Al finalizar la web quedará, por ejemplo, en `https://leopl72001.github.io/invitaciones-grado-pro/`.
6. En Supabase → **Authentication → URL Configuration**, agrega ese dominio a **Site URL / Redirect URLs**, si usas confirmación de correo.
7. Crea las invitaciones **desde la dirección publicada**, copia sus enlaces y compártelos por WhatsApp. En el panel verás las respuestas de los invitados.

> El workflow `.github/workflows/deploy.yml` está incluido. Usa `npm install` durante el despliegue; la instalación descarga las dependencias desde npm.

## Seguridad y límites

- GitHub guarda **el código fuente**, **no** el listado personal de invitados. Los invitados, grupos y confirmaciones se guardan en la base de datos privada de **Supabase**.
- Los visitantes NO pueden consultar el listado de personas ni sus teléfonos por API. Las funciones públicas solo acceden al invitado que conoce el token de su enlace.
- Los tokens individuales deben tratarse como enlaces privados: quien los tenga puede ver y modificar la confirmación de **esa invitación**. No hay autenticación de invitados.
- El usuario administrador debe usar una contraseña fuerte. Para uso comercial con tráfico alto conviene agregar CAPTCHA, rate limiting y monitorización.
- La fecha usa explícitamente `America/Bogota` (UTC−05:00), así que la cuenta regresiva funciona aunque el invitado esté en otro país.
- El modo demo con `localStorage` es una demostración: no sustituye un backend, no sincroniza dispositivos y se perdería si se borra el almacenamiento del navegador.

## Personalizaciones pendientes

- Nombre real del graduando y texto deseado.
- Dirección exacta, lugar y Google Maps.
- Tres fotografías y tres pistas de audio autorizadas (la primera para todos y las otras dos para invitados especiales).
- Textos de regalos y fecha límite de confirmación.

Los datos de ejemplo “Familia de ejemplo” e “Invitado especial” sirven para probar el catálogo. Puedes editarlos o eliminarlos.

## Selector de fragmentos musicales (nueva función)

En **Personalización → Canciones de 30 segundos** pega un enlace HTTPS que apunte a un archivo reproducible (MP3, M4A, OGG, WAV) o utiliza **Subir** (requiere Supabase). La duración se detecta en el navegador, aparece una línea de tiempo visual y puedes seleccionar el punto de inicio y pulsar **Escuchar recorte**. Después, pulsa **Guardar cambios**. La invitación comienza en ese segundo y detiene el audio pasados 30 segundos. El archivo no se corta físicamente: se configura el intervalo de reproducción, por lo que no consume almacenamiento extra.

Los enlaces normales a YouTube, Spotify o Instagram son páginas/plataformas, **no enlaces directos a archivos de audio**, y no se pueden convertir automáticamente en canciones recortadas. Usa música propia o autorizada. Algunas URLs directas protegidas también pueden impedir el acceso al audio.

Si ya creaste las tablas de Supabase con la versión anterior, ejecuta **`supabase/migration_music_clips.sql`** en SQL Editor una sola vez para agregar los tres tiempos de inicio y actualizar la función pública. Si aún no ejecutaste el SQL inicial, utiliza `supabase/schema.sql` actualizado.

## Música mediante enlaces de YouTube

En **Personalización → Canciones de 30 segundos** se aceptan enlaces directos a MP3/M4A/OGG **y enlaces a videos de YouTube** (`youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`).

Para YouTube, selecciona el minuto y el segundo de inicio en el editor, escucha la vista previa desde el reproductor oficial y guarda. La invitación también muestra el video oficial durante ese fragmento de 30 segundos (los parámetros `start` y `end` son segundos absolutos desde el inicio del video). No se descarga, extrae ni modifica audio de YouTube.

Debido a las condiciones de inserción de YouTube, **el reproductor debe estar visible** y el invitado debe tocar Play. No se puede utilizar YouTube como audio invisible de fondo. Algunos videos bloquean la reproducción en otras páginas y pueden mostrar anuncios. Para audio discreto usa un archivo MP3/M4A/OGG propio o autorizado.
