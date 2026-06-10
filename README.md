# CertificadoPro 🎓

**Editor visual de certificados masivos** — Crea, personaliza y exporta certificados PDF individuales desde cualquier plantilla PDF y datos Excel.

## 🌐 Demo en GitHub Pages

> Despliega este repositorio en GitHub Pages y accede desde cualquier navegador.

## ✨ Características

- 📄 **Cargar PDF** como plantilla base (detección automática de texto)
- 📊 **Excel/CSV flexible** — Funciona con cualquier formato de columnas
- 🎨 **Editor tipo Canva** — Mueve, redimensiona, edita texto y añade imágenes
- 🔗 **Vinculación de columnas** — Cada caja de texto puede vincularse a una columna del Excel
- 📝 **Opciones de texto** — Tipografía, tamaño, color, negrita, cursiva, alineación, espaciado
- ✅ **Revisor ortográfico** — Activado nativamente en el editor
- 🖼 **Imágenes PNG** — Añade firmas, logos o cualquier imagen
- 👁 **Vista previa** — Previsualiza cada certificado antes de exportar
- ⬇ **Exportación masiva** — Genera todos los PDFs en un clic
- 💾 **Formato .certificado** — Guarda y reabre tu proyecto en cualquier momento
- ↩ **Undo/Redo** — Historial de cambios (Ctrl+Z / Ctrl+Y)

## 🚀 Cómo usar

### 1. Abrir la app
Abre `index.html` directamente en tu navegador (Chrome, Edge, Firefox).

### 2. Cargar la plantilla
- Arrastra tu PDF al panel **"Plantilla PDF"**
- El PDF se renderizará como fondo del canvas
- El texto detectado en el PDF aparecerá como cajas editables

### 3. Cargar participantes
- Arrastra tu Excel (.xlsx, .xls) o CSV al panel **"Datos Excel"**
- Selecciona qué columnas usar marcando/desmarcando los checkboxes
- Elige cuál columna es el "nombre" para nombrar los PDFs exportados

### 4. Diseñar en el canvas
- **Doble clic** en el canvas vacío → añade una caja de texto
- **Arrastra una columna** del panel al canvas → crea caja vinculada automáticamente
- **Clic derecho** → menú contextual de opciones
- Ajusta fuente, tamaño, color, negrita en el panel derecho
- Añade imágenes PNG con el botón **"Imagen"** (para firmas, logos, etc.)

### 5. Vista previa
- En la pestaña **"Datos"**, haz clic en el ojo 👁 de cualquier participante
- O usa los botones ◀ ▶ para navegar entre certificados
- Botón **"↩ Volver a plantilla"** para restaurar el diseño

### 6. Exportar
- Botón **"⬇ Exportar PDFs"** → elige si exportar todos, el actual o un rango
- Cada PDF se descarga con el nombre del participante

### 7. Guardar proyecto
- Botón **"💾 Guardar .certificado"** → guarda diseño, plantilla y configuración
- Botón **"📂 Abrir proyecto"** → reabre un proyecto guardado

## ⌨️ Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `T` | Añadir caja de texto |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` | Rehacer |
| `Ctrl+S` | Guardar proyecto |
| `Ctrl+D` | Duplicar elemento |
| `Delete` | Eliminar elemento seleccionado |
| `Escape` | Cerrar menú contextual |
| `Ctrl+Scroll` | Zoom in/out |

## 🔧 Variables en texto

Puedes usar variables `{{NombreColumna}}` directamente en las cajas de texto libres:

```
Certifica que {{Nombre}} {{Apellido}}
ha participado en {{Curso}}
el día {{Fecha}}
```

Al exportar, estas variables se reemplazan automáticamente con los datos del Excel.

## 📋 Formato .certificado

El archivo `.certificado` es un ZIP comprimido que contiene:
- El estado completo del canvas (posiciones, textos, imágenes)
- La plantilla PDF original (en base64)
- La configuración de columnas vinculadas

## 🌐 Desplegar en GitHub Pages

1. Crea un repositorio en GitHub
2. Sube todos los archivos (index.html, styles.css, js/)
3. Ve a **Settings → Pages → Branch: main → Save**
4. Tu app estará en `https://tu-usuario.github.io/tu-repositorio/`

## 📦 Dependencias (cargadas por CDN)

- [PDF.js](https://mozilla.github.io/pdf.js/) — Renderizado de PDF
- [Fabric.js](http://fabricjs.com/) — Canvas interactivo
- [SheetJS](https://sheetjs.com/) — Lectura de Excel
- [jsPDF](https://parall.ax/products/jspdf) — Generación de PDF
- [JSZip](https://stuk.github.io/jszip/) — Formato .certificado

> 💡 **Sin instalación requerida** — Funciona 100% en el navegador, sin servidor ni Node.js.
