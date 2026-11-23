# Farmacias Zaragoza — candidatura GitHub Pages v0.2

**Estado:** CANDIDATA NO ACEPTADA. **Baseline aceptada:** v0.1.3 local con Python (no se modifica).

## Contenido
Este ZIP contiene solo archivos estáticos para la raíz de un repositorio GitHub Pages. `index.html` consulta directamente la API del Ayuntamiento de Zaragoza. No incluye un servidor Python ni credenciales.

## Publicar (cuando lo autorices)
1. Crea un repositorio **público** nuevo en GitHub, por ejemplo `farmacias-zaragoza`, sin subir los ficheros del servidor local anterior.
2. Sube **el contenido** de este ZIP a la raíz de la rama `main` (no la carpeta contenedora).
3. En `Settings > Pages > Build and deployment > Source`, elige `Deploy from a branch`, `main`, `/(root)`; guarda.
4. Una vez activo HTTPS, abre `https://TU_USUARIO.github.io/farmacias-zaragoza/diagnostico-cors.html` y pulsa el botón.
5. Si responde HTTP 200 con JSON válido, abre `https://TU_USUARIO.github.io/farmacias-zaragoza/` y comprueba guardia, ampliado, todas, mapa, horario, teléfono, fecha y caché.
6. Si falla por CORS, **no publiques esta versión como aplicación operativa**: la arquitectura requerirá un intermediario en un alojamiento con backend u otra fuente oficial con CORS habilitado. GitHub Pages por sí solo no puede ejecutar Python.

## Instalación posterior en Android
Solo tras validar la API desde la URL pública: abre la URL HTTPS en Chrome o Edge Android y utiliza `Añadir a pantalla de inicio`/`Instalar aplicación` según el navegador. Debe funcionar conectado a Internet para obtener turnos; el service worker solo conserva la interfaz, **no los turnos**.

## Condiciones y seguridad
- No presenta registros de ejemplo como actuales ni determina automáticamente «abierta ahora» por figurar de guardia.
- Datos de guardia en memoria hasta 90 s y sin cruzar el cambio de turno de 09:15, sujeto a reloj del dispositivo.
- Directorio y horario ampliado hasta 10 minutos en memoria.
- Posible lentitud inicial por consultar páginas de 200 registros. Su rendimiento real se medirá desde el móvil.
- Consultas enviadas directamente al Ayuntamiento; cartografía externa OpenStreetMap y librería Leaflet desde CDN.
- No se almacenan permanentemente coordenadas de usuario.
- Se requiere comprobar licencia/atribución y condiciones de la fuente antes de publicar de forma estable.

## Evidencia pendiente
Aún no se dispone de una prueba real de CORS desde GitHub Pages. No hay publicación automática en la cuenta del usuario.
