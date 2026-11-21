# GradoPro 🎓 — Invitaciones interactivas de graduación

Aplicación React + TypeScript + Vite para la fiesta de **Licenciatura en Matemáticas** del **18 de diciembre de 2026, a las 6:00 p. m. (hora de Colombia)**.

## Incluye

- Invitación elegante y responsiva: sobre animado, estrellas matemáticas, fotos Polaroid, confeti, desplazamientos animados, cuenta regresiva en vivo y música de hasta 30 segundos.
- Panel administrativo para **crear, editar, eliminar y filtrar invitados**, cada uno con **nombre, grupo, cupos, teléfono y enlace exclusivo**.
- Catálogo de invitaciones y botones **Copiar enlace**, **Vista previa** y **Enviar por WhatsApp**.
- Grupos de invitados (familia, amigos, etc.) y cupos sugeridos por grupo.
- Música de fondo sin reproductor visible: pega una URL de audio directo (MP3/M4A/OGG/WAV). El clip empieza al abrir el sobre y se detiene después de 30 segundos. YouTube no puede usarse como audio invisible.
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
3. Abre **Authentication → Sign In / Providers → Anonymous Sign-Ins** y habilita el acceso anónimo. GradoPro creará una sesión automáticamente sin pedir correo o contraseña.
4. Abre **Project Settings → API** y copia `Project URL` y la **anon / publishable key**. **Nunca uses la clave service_role** en esta aplicación.
5. En el proyecto, copia `.env.example` a `.env` y escribe:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
   ```

6. Reinicia `npm run dev` y abre el panel. No requiere registro; el primer acceso crea una sesión anónima que se conserva en ese navegador y registra tu evento.
7. En **Personalización**, agrega nombre, dirección, Google Maps, fotos y el enlace de la canción principal; puedes añadir también dos canciones especiales. Pulsa **Guardar cambios**.
8. Crea grupos, registra invitados, establece cupos y asigna la canción especial solo a las 2 invitaciones que quieras.

### Sobre fotos y música

Se pueden pegar URLs públicas HTTPS o subir archivos al bucket `invitation-assets` con el botón **Subir** (requiere iniciar sesión en Supabase). Las fotografías y los clips subidos serán **públicos para quien conozca su URL**, no incluyas archivos privados. Para los audios usa material propio o autorizado; la app limita la reproducción a 30 segundos, pero eso no sustituye los permisos de uso.

Para iniciar música con sonido, los navegadores suelen exigir una interacción humana. GradoPro aprovecha el clic sobre **«Abrir mi invitación»** (o sobre el sobre) para reproducir el audio MP3 directamente, sin mostrar reproductor ni exigir un segundo Play. Enlaces de YouTube, Spotify o páginas de escucha **no son archivos de audio directos** y no funcionarán en este modo. Para incluir música de esas plataformas sin video debes obtener un archivo autorizado y hospedarlo en una URL pública directa, por ejemplo en Supabase Storage.

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


## Música simplificada y reproducción al abrir

- **Personalización → Música de las invitaciones:** pega el enlace directo de un MP3/M4A/OGG/WAV. Ya no hay editor de tijera ni video de YouTube en la invitación.
- La **canción principal** corresponde a todos los invitados, salvo las dos invitaciones marcadas como **Especial 1** o **Especial 2**. La asignación se hace al crear/editar la invitación individual. Si una pista especial está vacía, se utiliza la principal.
- Al tocar el sobre o **«Abrir mi invitación»**, se llama a `audio.play()` en ese mismo gesto para reproducir automáticamente el audio de fondo. Se detiene tras **30 segundos** y se puede pausar desde el icono de música.
- El reproductor de YouTube fue eliminado de la invitación. Si antes había un enlace de YouTube guardado, **no se oirá** hasta reemplazarlo por una URL de audio directo. El panel muestra una advertencia en ese campo. No se oculta el reproductor de YouTube, no se extrae su audio y no se promete reproducción automática sin interacción.
- Al pegar otro enlace nuevo, la selección anterior se restablece a los primeros 30 segundos. El resto de ajustes, los grupos y las confirmaciones no se modifican.
- Las canciones deben ser propias o contar con los permisos de uso correspondientes. El botón **Subir MP3** funciona después de configurar Supabase Storage.

> Antes de compartir enlaces reales hay que configurar Supabase. El modo demostración sigue almacenando los invitados y cambios solo en el navegador donde se editaron.
## Activación de la conexión Supabase en GitHub Pages

El workflow de GitHub Pages lee las variables de repositorio `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` durante `npm run build`. Después de configurarlas, un nuevo commit en `main` genera una compilación que incorpora los valores públicos y habilita el acceso a Supabase. Para subir canciones desde la interfaz, primero hay que iniciar sesión en GradoPro con una cuenta de Supabase Auth y haber ejecutado `supabase/schema.sql` en SQL Editor.

## Acceso al panel sin login (noviembre de 2026)

El panel no solicita correo ni contraseña. Usa el método documentado de Supabase `supabase.auth.signInAnonymously()` y las políticas RLS ya instaladas para separar los datos de cada sesión.

**Acción indispensable:** en Supabase, habilita `Authentication → Sign In / Providers → Anonymous Sign-Ins`. Si no lo habilitas, GradoPro muestra instrucciones para activarlo y el botón «Entrar sin contraseña».

**Limitación importante:** esta sesión pertenece al navegador y se guarda localmente. No borres los datos/cookies del sitio ni uses modo incógnito para gestionar el evento: perder la sesión puede impedirte volver a editar los invitados existentes. Los enlaces de los invitados continuarán funcionando en la nube. Para recuperar la gestión desde otro dispositivo será necesario incorporar un mecanismo de recuperación seguro. El panel es público y crear sesiones anónimas está sujeto a uso/abuso; para despliegue comercial hacen falta restricciones adicionales.
