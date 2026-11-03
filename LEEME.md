# Completa la pirámide · Universidad IEXPRO

Actividad web breve: se escanea un QR, se responden las preguntas, cada acierto agrega una cara a la pirámide de cristal y, al completarla, aparece el holograma 3D del monograma. La cámara es opcional y se puede activar en cualquier momento.

## Cambiar preguntas o textos

Edita `preguntas.js`. La pirámide tiene una cara por pregunta (de 3 a 6). Si cambias la cantidad, actualiza también el texto de `introduccion` y las descripciones de `index.html`.

## Publicar y crear el QR

1. Sube el **contenido de esta carpeta** a un hosting estático con HTTPS, como GitHub Pages o Netlify. En teléfonos, la cámara solo funciona con HTTPS.
2. Abre `https://TU-DIRECCION/cartel.html`. El QR toma la dirección publicada automáticamente.
3. Pulsa **Imprimir cartel** o **Descargar QR**.
4. Antes de imprimir, escanéalo con un Android y con un iPhone, y prueba la cámara en ambos.

Si la dirección de la actividad cambia, hay que generar e imprimir un QR nuevo.

## Si la cámara falla

La actividad muestra el motivo en pantalla, con un código al final:

| Código | Qué suele significar |
|---|---|
| `NotAllowedError` | El navegador o el sistema bloqueó el permiso |
| `NotReadableError`, `AbortError`, `SinImagen` | Otra aplicación usa la cámara |
| `NotFoundError` | No hay cámara disponible |

Si el aviso habla de una dirección segura, la página se abrió sin HTTPS. Los navegadores integrados en otras aplicaciones también pueden bloquear la cámara: abre el enlace en Chrome o Safari.

## Archivos

| Archivo | Función |
|---|---|
| `preguntas.js` | Preguntas y textos |
| `index.html`, `estilos.css`, `app.js` | Pantallas, diseño, preguntas y cámara |
| `escena.js` | Pirámide y holograma en 3D |
| `cartel.html`, `vendor/qrcode.js` | Cartel imprimible con el QR |
| `vendor/three-tres.js` | Three.js empaquetado; se regenera con `../herramientas/three-entrada.js` |
| `assets/` | Logo, monograma, texturas incrustadas y tipografías |

## Marca

- El logo conserva sus colores sobre una placa blanca.
- El azul `#363F82` y el magenta `#CD2B81` del logo se intensifican en el fondo, la figura y el holograma para que brillen en pantalla.
- El arco de la hoja inferior retoma el trazo del logo.
- Cinzel y Montserrat son tipografías parecidas a las del logo, no necesariamente las oficiales.

## Licencias de terceros

- Three.js: licencia MIT (`vendor/three-LICENSE.txt`).
- Cinzel y Montserrat: SIL Open Font License.
- `vendor/qrcode.js` (qrcode-generator, de Kazuhiko Arase): licencia MIT. «QR Code» es marca registrada de DENSO WAVE INCORPORATED.
