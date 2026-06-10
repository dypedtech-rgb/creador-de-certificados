/**
 * editor.js - Lógica de Canvas con Fabric.js y Renderizado de fondo con PDF.js
 */

// Parche para error de CanvasTextBaseline 'alphabetical' en Fabric.js
const originalSetTextBaseline = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'textBaseline').set;
Object.defineProperty(CanvasRenderingContext2D.prototype, 'textBaseline', {
    set: function(val) {
        if (val === 'alphabetical') val = 'alphabetic';
        originalSetTextBaseline.call(this, val);
    }
});

// Configuración de pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Inicializar Canvas de Fabric
const canvas = new fabric.Canvas('certificateCanvas', {
    preserveObjectStacking: true,
    selection: true
});
window.fabricCanvas = canvas; // Exportar globalmente para otros scripts

// Variables de estado interno del editor
let historyStack = [];
let redoStack = [];
let isHistoryAction = false;
let currentZoom = 1;

// Referencias a elementos UI
const pdfDropZone = document.getElementById('pdfDropZone');
const pdfInput = document.getElementById('pdfInput');
const pdfInfo = document.getElementById('pdfInfo');
const pdfFileName = document.getElementById('pdfFileName');
const btnClearPDF = document.getElementById('btnClearPDF');
const canvasPlaceholder = document.getElementById('canvasPlaceholder');

// Guardar el estado inicial para poder restaurarlo
function saveHistory() {
    if (isHistoryAction) return;
    redoStack = [];
    historyStack.push(JSON.stringify(canvas));
    if (historyStack.length > 50) historyStack.shift(); // Límite de 50 pasos
}

canvas.on('object:added', saveHistory);
canvas.on('object:modified', saveHistory);
canvas.on('object:removed', saveHistory);

// ======================== CARGA DE PDF ========================
function handlePDFFile(file) {
    if (!file || file.type !== 'application/pdf') {
        window.showToast('Por favor, selecciona un archivo PDF.', 'error');
        return;
    }
    
    window.showLoader('Cargando plantilla PDF...');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const typedarray = new Uint8Array(e.target.result);
        window.AppState.pdfBytes = typedarray;
        window.AppState.pdfFile = file;
        
        pdfDropZone.classList.add('hidden');
        pdfInfo.classList.remove('hidden');
        pdfFileName.textContent = file.name;
        
        try {
            const pdf = await pdfjsLib.getDocument(typedarray.slice(0)).promise;
            const page = await pdf.getPage(1);
            
            // Escala alta para renderizar una imagen nítida en el canvas
            const scale = 2; 
            const viewport = page.getViewport({ scale: scale });
            
            // Renderizar la página del PDF en un canvas temporal
            const tempCanvas = document.createElement('canvas');
            const context = tempCanvas.getContext('2d');
            tempCanvas.height = viewport.height;
            tempCanvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const dataUrl = tempCanvas.toDataURL('image/png', 1.0);
            window.AppState.pdfImageSrc = dataUrl;
            
            // Ajustar el canvas de Fabric al tamaño de la vista (viewport sin escala extra para UI)
            const baseViewport = page.getViewport({ scale: 1 });
            canvas.setWidth(baseViewport.width);
            canvas.setHeight(baseViewport.height);
            
            fabric.Image.fromURL(dataUrl, (img) => {
                img.scaleToWidth(baseViewport.width);
                img.scaleToHeight(baseViewport.height);
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    originX: 'left',
                    originY: 'top'
                });
                
                canvasPlaceholder.classList.add('hidden');
                saveHistory();
                window.hideLoader();
                window.showToast('Plantilla PDF cargada correctamente', 'success');
            });
        } catch (error) {
            console.error(error);
            window.hideLoader();
            window.showToast('Error al leer el PDF', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Eventos de Dropzone para PDF
pdfDropZone.addEventListener('click', (e) => {
    if(e.target.tagName !== 'BUTTON') pdfInput.click();
});
document.getElementById('btnPickPDF').addEventListener('click', () => pdfInput.click());
pdfInput.addEventListener('change', (e) => handlePDFFile(e.target.files[0]));

pdfDropZone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropZone.style.borderColor = 'var(--accent-primary)'; });
pdfDropZone.addEventListener('dragleave', () => { pdfDropZone.style.borderColor = ''; });
pdfDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfDropZone.style.borderColor = '';
    handlePDFFile(e.dataTransfer.files[0]);
});

btnClearPDF.addEventListener('click', () => {
    window.AppState.pdfBytes = null;
    window.AppState.pdfFile = null;
    window.AppState.pdfImageSrc = null;
    canvas.clear();
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    pdfDropZone.classList.remove('hidden');
    pdfInfo.classList.add('hidden');
    canvasPlaceholder.classList.remove('hidden');
    historyStack = [];
    redoStack = [];
});

// ======================== HERRAMIENTAS DE EDICIÓN ========================
document.getElementById('btnAddText').addEventListener('click', () => {
    if(!window.AppState.pdfBytes) return window.showToast('Carga un PDF primero', 'error');
    
    const text = new fabric.Textbox('Nuevo Texto', {
        width: 350,
        left: canvas.width / 2,
        top: canvas.height / 2,
        fontFamily: 'Inter',
        fontSize: 32,
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        textAlign: 'left',
        splitByGrapheme: false,
        customData: {
            isColumnBound: false,
            columnName: ''
        }
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
});

document.getElementById('btnAddImage').addEventListener('click', () => {
    if(!window.AppState.pdfBytes) return window.showToast('Carga un PDF primero', 'error');
    document.getElementById('imageInput').click();
});

document.getElementById('btnAddLine').addEventListener('click', () => {
    if(!window.AppState.pdfBytes) return window.showToast('Carga un PDF primero', 'error');
    const line = new fabric.Line([50, 50, 250, 50], {
        left: canvas.width / 2,
        top: canvas.height / 2,
        stroke: '#000000',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        cornerColor: 'var(--accent-primary)',
        borderColor: 'var(--accent-primary)',
        cornerSize: 8,
        transparentCorners: false
    });
    // Limitar controles de la línea (no escalar Y, no rotar X)
    line.setControlsVisibility({
        mt: false, mb: false, ml: true, mr: true, bl: false, br: false, tl: false, tr: false
    });
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.requestRenderAll();
});

document.getElementById('btnAddDashedLine').addEventListener('click', () => {
    if(!window.AppState.pdfBytes) return window.showToast('Carga un PDF primero', 'error');
    const line = new fabric.Line([50, 50, 250, 50], {
        left: canvas.width / 2,
        top: canvas.height / 2,
        stroke: '#000000',
        strokeWidth: 2,
        strokeDashArray: [10, 5],
        originX: 'center',
        originY: 'center',
        cornerColor: 'var(--accent-primary)',
        borderColor: 'var(--accent-primary)',
        cornerSize: 8,
        transparentCorners: false
    });
    line.setControlsVisibility({
        mt: false, mb: false, ml: true, mr: true, bl: false, br: false, tl: false, tr: false
    });
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.requestRenderAll();
});

document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (f) => {
        const data = f.target.result;
        fabric.Image.fromURL(data, (img) => {
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center'
            });
            // Escalar un poco si es muy grande
            if(img.width > 300) img.scaleToWidth(300);
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.requestRenderAll();
        });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset
});

// ======================== DESHACER / REHACER ========================
document.getElementById('btnUndo').addEventListener('click', () => {
    if (historyStack.length === 0) return;
    isHistoryAction = true;
    redoStack.push(JSON.stringify(canvas));
    const prevState = historyStack.pop();
    canvas.loadFromJSON(prevState, () => {
        canvas.renderAll();
        isHistoryAction = false;
        updatePropertiesPanel();
    });
});

document.getElementById('btnRedo').addEventListener('click', () => {
    if (redoStack.length === 0) return;
    isHistoryAction = true;
    historyStack.push(JSON.stringify(canvas));
    const nextState = redoStack.pop();
    canvas.loadFromJSON(nextState, () => {
        canvas.renderAll();
        isHistoryAction = false;
        updatePropertiesPanel();
    });
});

// Teclado
window.addEventListener('keydown', (e) => {
    // CMD+Z o CTRL+Z para Deshacer, CMD+SHIFT+Z o CTRL+Y para Rehacer
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
            document.getElementById('btnRedo').click(); // Cmd+Shift+Z / Ctrl+Shift+Z
        } else {
            document.getElementById('btnUndo').click(); // Cmd+Z / Ctrl+Z
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        document.getElementById('btnRedo').click(); // Ctrl+Y
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObj = canvas.getActiveObject();
        if(activeObj && activeObj.type !== 'i-text' || (activeObj && !activeObj.isEditing)) {
            canvas.remove(activeObj);
            canvas.discardActiveObject();
        }
    } else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        const activeObj = canvas.getActiveObject();
        if(activeObj && !activeObj.isEditing) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            if(e.key === 'ArrowUp') activeObj.set('top', activeObj.top - step);
            if(e.key === 'ArrowDown') activeObj.set('top', activeObj.top + step);
            if(e.key === 'ArrowLeft') activeObj.set('left', activeObj.left - step);
            if(e.key === 'ArrowRight') activeObj.set('left', activeObj.left + step);
            canvas.requestRenderAll();
        }
    }
});

// ======================== PANEL DE PROPIEDADES ========================
const panelNoSelection = document.getElementById('noSelectionMsg');
const panelText = document.getElementById('textProperties');
const panelImage = document.getElementById('imageProperties');

// Controles de Texto
const textControls = {
    columnBindSelect: document.getElementById('columnBindSelect'),
    fontFamily: document.getElementById('fontFamily'),
    fontSize: document.getElementById('fontSize'),
    fontColor: document.getElementById('fontColor'),
    btnBold: document.getElementById('btnBold'),
    btnItalic: document.getElementById('btnItalic'),
    btnUnderline: document.getElementById('btnUnderline'),
    btnLinethrough: document.getElementById('btnLinethrough'),
    btnAlignLeft: document.getElementById('btnAlignLeft'),
    btnAlignCenter: document.getElementById('btnAlignCenter'),
    btnAlignRight: document.getElementById('btnAlignRight'),
    lineHeight: document.getElementById('lineHeight'),
    charSpacing: document.getElementById('charSpacing'),
    objX: document.getElementById('objX'),
    objY: document.getElementById('objY'),
    objOpacity: document.getElementById('objOpacity'),
    objRotation: document.getElementById('objRotation')
};

// Actualizar panel cuando se selecciona o modifica un objeto
function updatePropertiesPanel() {
    const activeObj = canvas.getActiveObject();
    
    if (!activeObj) {
        panelNoSelection.classList.remove('hidden');
        panelText.classList.add('hidden');
        panelImage.classList.add('hidden');
        return;
    }
    
    panelNoSelection.classList.add('hidden');
    
    if (activeObj.type === 'textbox' || activeObj.type === 'i-text' || activeObj.type === 'text') {
        panelText.classList.remove('hidden');
        panelImage.classList.add('hidden');
        
        // Cargar valores del objeto al UI
        textControls.fontFamily.value = activeObj.fontFamily || 'Inter';
        textControls.fontFamily.style.fontFamily = activeObj.fontFamily || 'Inter';
        textControls.fontSize.value = Math.round(activeObj.fontSize * (activeObj.scaleX || 1));
        textControls.fontColor.value = activeObj.fill || '#000000';
        
        if(activeObj.fontWeight === 'bold') textControls.btnBold.classList.add('active');
        else textControls.btnBold.classList.remove('active');
        
        if(activeObj.fontStyle === 'italic') textControls.btnItalic.classList.add('active');
        else textControls.btnItalic.classList.remove('active');
        
        if(activeObj.underline) textControls.btnUnderline.classList.add('active');
        else textControls.btnUnderline.classList.remove('active');
        
        if(activeObj.linethrough) textControls.btnLinethrough.classList.add('active');
        else textControls.btnLinethrough.classList.remove('active');
        
        textControls.btnAlignLeft.classList.remove('active');
        textControls.btnAlignCenter.classList.remove('active');
        textControls.btnAlignRight.classList.remove('active');
        if(activeObj.textAlign === 'center') textControls.btnAlignCenter.classList.add('active');
        else if(activeObj.textAlign === 'right') textControls.btnAlignRight.classList.add('active');
        else textControls.btnAlignLeft.classList.add('active');
        
        textControls.lineHeight.value = activeObj.lineHeight || 1.2;
        textControls.charSpacing.value = activeObj.charSpacing || 0;
        
        textControls.objX.value = Math.round(activeObj.left);
        textControls.objY.value = Math.round(activeObj.top);
        textControls.objOpacity.value = Math.round((activeObj.opacity || 1) * 100);
        textControls.objRotation.value = Math.round(activeObj.angle || 0);
        
        // Column bind (data personalizada)
        if(activeObj.customData && activeObj.customData.isColumnBound) {
            textControls.columnBindSelect.value = activeObj.customData.columnName;
        } else {
            textControls.columnBindSelect.value = '';
        }
        
    } else if (activeObj.type === 'image') {
        panelText.classList.add('hidden');
        panelImage.classList.remove('hidden');
        
        document.getElementById('imgX').value = Math.round(activeObj.left);
        document.getElementById('imgY').value = Math.round(activeObj.top);
        document.getElementById('imgW').value = Math.round(activeObj.width * activeObj.scaleX);
        document.getElementById('imgH').value = Math.round(activeObj.height * activeObj.scaleY);
        document.getElementById('imgOpacity').value = Math.round((activeObj.opacity || 1) * 100);
        document.getElementById('imgRotation').value = Math.round(activeObj.angle || 0);
    }
}

canvas.on('selection:created', updatePropertiesPanel);
canvas.on('selection:updated', updatePropertiesPanel);
canvas.on('selection:cleared', updatePropertiesPanel);
canvas.on('object:modified', updatePropertiesPanel);
canvas.on('object:moving', updatePropertiesPanel);
canvas.on('object:scaling', updatePropertiesPanel);
canvas.on('object:rotating', updatePropertiesPanel);

// Pre-load ALL fonts at startup so canvas can use them immediately
const ALL_CANVAS_FONTS = ['Inter', 'Montserrat', 'Roboto Condensed', 'Oswald', 'Fira Sans Condensed', 'Anton'];
const FONT_WEIGHTS = ['400', '700'];

async function preloadAllFonts() {
    const loads = [];
    ALL_CANVAS_FONTS.forEach(family => {
        FONT_WEIGHTS.forEach(weight => {
            loads.push(document.fonts.load(`${weight} 16px '${family}'`));
        });
    });
    await Promise.allSettled(loads);
    console.log('[CertPro] Todas las fuentes precargadas:', ALL_CANVAS_FONTS.join(', '));
}
preloadAllFonts();

textControls.fontFamily.addEventListener('change', async (e) => {
    const fontName = e.target.value;
    // Wait for the selected font to be ready before applying to canvas
    await Promise.allSettled([
        document.fonts.load(`400 16px '${fontName}'`),
        document.fonts.load(`700 16px '${fontName}'`),
        document.fonts.load(`400 16px ${fontName}`),
        document.fonts.load(`700 16px ${fontName}`)
    ]);
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) { 
        obj.set('fontFamily', fontName); 
        canvas.requestRenderAll(); 
    }
    textControls.fontFamily.style.fontFamily = fontName;
});

textControls.fontSize.addEventListener('input', (e) => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) { 
        obj.set('fontSize', parseInt(e.target.value)); 
        obj.set('scaleX', 1); obj.set('scaleY', 1); 
        canvas.requestRenderAll(); 
    }
});

document.getElementById('fontSizeDown').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
        let size = parseInt(textControls.fontSize.value) || 24;
        if(size > 6) size--;
        textControls.fontSize.value = size;
        obj.set('fontSize', size);
        obj.set('scaleX', 1); obj.set('scaleY', 1);
        canvas.requestRenderAll();
    }
});

document.getElementById('fontSizeUp').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
        let size = parseInt(textControls.fontSize.value) || 24;
        if(size < 400) size++;
        textControls.fontSize.value = size;
        obj.set('fontSize', size);
        obj.set('scaleX', 1); obj.set('scaleY', 1);
        canvas.requestRenderAll();
    }
});

textControls.fontColor.addEventListener('input', (e) => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) { obj.set('fill', e.target.value); canvas.requestRenderAll(); }
});

textControls.btnBold.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) { 
        const isBold = obj.fontWeight === 'bold';
        obj.set('fontWeight', isBold ? 'normal' : 'bold'); 
        updatePropertiesPanel();
        canvas.requestRenderAll(); 
    }
});

textControls.btnItalic.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) { 
        const isItalic = obj.fontStyle === 'italic';
        obj.set('fontStyle', isItalic ? 'normal' : 'italic'); 
        updatePropertiesPanel();
        canvas.requestRenderAll(); 
    }
});

textControls.btnAlignLeft.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
        obj.set('textAlign', 'left');
        if (obj.type === 'textbox' && (!obj.width || obj.width < 50)) {
            obj.set('width', 300);
        }
        canvas.requestRenderAll();
        updatePropertiesPanel();
    }
});
textControls.btnAlignCenter.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
        obj.set('textAlign', 'center');
        // Ensure textbox has a width for alignment to work
        if (obj.type === 'textbox' && (!obj.width || obj.width < 50)) {
            obj.set('width', 300);
        }
        canvas.requestRenderAll();
        updatePropertiesPanel();
    }
});
textControls.btnAlignRight.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
        obj.set('textAlign', 'right');
        if (obj.type === 'textbox' && (!obj.width || obj.width < 50)) {
            obj.set('width', 300);
        }
        canvas.requestRenderAll();
        updatePropertiesPanel();
    }
});

// Columna vinculada
textControls.columnBindSelect.addEventListener('change', (e) => {
    const obj = canvas.getActiveObject();
    if(obj && (obj.type === 'textbox' || obj.type === 'i-text')) { 
        const val = e.target.value;
        if(val) {
            obj.customData = { isColumnBound: true, columnName: val };
            obj.set('text', `{${val}}`);
        } else {
            obj.customData = { isColumnBound: false, columnName: '' };
        }
        canvas.requestRenderAll();
    }
});

// Botones de acciones de objeto (Eliminar, duplicar, ordenar)
document.getElementById('btnDeleteSelected').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj) { canvas.remove(obj); canvas.discardActiveObject(); }
});
document.getElementById('btnDeleteImg').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj) { canvas.remove(obj); canvas.discardActiveObject(); }
});

document.getElementById('btnDuplicate').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj) {
        obj.clone((cloned) => {
            cloned.set({ left: obj.left + 20, top: obj.top + 20 });
            if (cloned.type === 'textbox' || obj.type === 'i-text') {
                cloned.set({ customData: JSON.parse(JSON.stringify(obj.customData || {})) });
            }
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
        });
    }
});

document.getElementById('btnBringFront').addEventListener('click', () => { const obj = canvas.getActiveObject(); if(obj) canvas.bringForward(obj); });
document.getElementById('btnSendBack').addEventListener('click', () => { const obj = canvas.getActiveObject(); if(obj) canvas.sendBackwards(obj); });

// ======================== ZOOM ========================
const zoomLevelText = document.getElementById('zoomLevel');
const canvasWrapper = document.getElementById('canvasWrapper');

function setZoom(factor) {
    if (factor < 0.2 || factor > 3) return;
    currentZoom = factor;
    zoomLevelText.textContent = Math.round(factor * 100) + '%';
    
    // Scale wrapper using transform
    canvasWrapper.style.transform = `scale(${currentZoom})`;
    canvasWrapper.style.transformOrigin = 'center center';
}

document.getElementById('btnZoomIn').addEventListener('click', () => setZoom(currentZoom + 0.1));
document.getElementById('btnZoomOut').addEventListener('click', () => setZoom(currentZoom - 0.1));
document.getElementById('btnZoomReset').addEventListener('click', () => {
    setZoom(1);
    document.getElementById('canvasArea').scrollTo(0,0);
});

// Guardar y Abrir proyecto .certificado
document.getElementById('btnSaveCert').addEventListener('click', () => {
    if(!window.AppState.pdfBytes) return window.showToast('No hay nada que guardar', 'error');
    
    // Necesitamos guardar los objetos de canvas, los metadatos de las columnas vinculadas, y el pdf base en base64
    const projectData = {
        canvas: canvas.toJSON(['customData']), // Asegurar de guardar customData
        pdfImageSrc: window.AppState.pdfImageSrc,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
        // Omitiremos guardar el PDF en arraybuffer gigante para no sobrecargar el JSON,
        // esto implicaría que el usuario debe volver a subir el PDF original, o guardamos el PDF en base64
    };
    
    // Guardar el Uint8Array del PDF a Base64
    let binary = '';
    const bytes = new Uint8Array(window.AppState.pdfBytes);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    projectData.pdfBase64 = window.btoa(binary);

    const json = JSON.stringify(projectData);
    const blob = new Blob([json], {type: "application/json"});
    const url  = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla.certificado';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

document.getElementById('btnOpenCert').addEventListener('click', () => {
    document.getElementById('certFileInput').click();
});

document.getElementById('certFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    window.showLoader("Cargando proyecto...");
    const reader = new FileReader();
    reader.onload = (f) => {
        try {
            const data = JSON.parse(f.target.result);
            
            // Restaurar PDF bytes
            const binary_string = window.atob(data.pdfBase64);
            const len = binary_string.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary_string.charCodeAt(i);
            }
            window.AppState.pdfBytes = bytes;
            window.AppState.pdfImageSrc = data.pdfImageSrc;
            
            // Restaurar Canvas
            canvas.loadFromJSON(data.canvas, async () => {
                // Post-load: ensure all textbox objects have proper width (fix for old projects)
                canvas.getObjects().forEach(obj => {
                    if (obj.type === 'textbox') {
                        if (!obj.width || obj.width < 10) obj.set('width', 350);
                        // Upgrade i-text to textbox behavior if needed
                    } else if (obj.type === 'i-text') {
                        // Convert i-text to textbox for alignment support
                        const tbx = new fabric.Textbox(obj.text, {
                            left: obj.left,
                            top: obj.top,
                            width: Math.max(obj.width || 0, 350),
                            fontSize: obj.fontSize,
                            fontFamily: obj.fontFamily,
                            fill: obj.fill,
                            fontWeight: obj.fontWeight,
                            fontStyle: obj.fontStyle,
                            underline: obj.underline,
                            linethrough: obj.linethrough,
                            textAlign: obj.textAlign || 'left',
                            lineHeight: obj.lineHeight,
                            charSpacing: obj.charSpacing,
                            opacity: obj.opacity,
                            angle: obj.angle,
                            customData: obj.customData
                        });
                        canvas.remove(obj);
                        canvas.add(tbx);
                    }
                });

                // Pre-load all fonts used by the restored objects
                const usedFonts = new Set();
                canvas.getObjects().forEach(obj => {
                    if (obj.fontFamily) usedFonts.add(obj.fontFamily);
                });
                const fontLoads = [];
                usedFonts.forEach(family => {
                    fontLoads.push(document.fonts.load(`400 16px '${family}'`));
                    fontLoads.push(document.fonts.load(`700 16px '${family}'`));
                });
                await Promise.allSettled(fontLoads);

                // Configurar fondo de nuevo
                fabric.Image.fromURL(data.pdfImageSrc, (img) => {
                    const cWidth = data.canvasWidth || (data.canvas.width || (img.width / 2));
                    const cHeight = data.canvasHeight || (data.canvas.height || (img.height / 2));

                    canvas.setWidth(cWidth);
                    canvas.setHeight(cHeight);
                    img.scaleToWidth(cWidth);
                    img.scaleToHeight(cHeight);

                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                        originX: 'left',
                        originY: 'top'
                    });

                    canvasPlaceholder.classList.add('hidden');
                    pdfDropZone.classList.add('hidden');
                    pdfInfo.classList.remove('hidden');
                    pdfFileName.textContent = 'Proyecto restaurado';

                    window.hideLoader();
                    window.showToast('Proyecto cargado exitosamente', 'success');
                });
            });
            
        } catch(err) {
            console.error(err);
            window.hideLoader();
            window.showToast("Error al cargar el archivo de proyecto", "error");
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
});

// ======================== GU�AS INTELIGENTES (SMART GUIDES) ========================
function initAligningGuidelines(canvas) {
    var ctx = canvas.getSelectionContext(),
        aligningLineOffset = 5,
        aligningLineMargin = 4,
        aligningLineWidth = 1,
        aligningLineColor = 'rgb(0,255,0)',
        viewportTransform,
        zoom = 1;

    function drawVerticalLine(coords) {
        drawLine(
            coords.x + 0.5,
            coords.y1 > coords.y2 ? coords.y2 : coords.y1,
            coords.x + 0.5,
            coords.y2 > coords.y1 ? coords.y2 : coords.y1
        );
    }

    function drawHorizontalLine(coords) {
        drawLine(
            coords.x1 > coords.x2 ? coords.x2 : coords.x1,
            coords.y + 0.5,
            coords.x2 > coords.x1 ? coords.x2 : coords.x1,
            coords.y + 0.5
        );
    }

    function drawLine(x1, y1, x2, y2) {
        ctx.save();
        ctx.lineWidth = aligningLineWidth;
        ctx.strokeStyle = aligningLineColor;
        ctx.beginPath();
        ctx.moveTo(x1 * zoom + viewportTransform[4], y1 * zoom + viewportTransform[5]);
        ctx.lineTo(x2 * zoom + viewportTransform[4], y2 * zoom + viewportTransform[5]);
        ctx.stroke();
        ctx.restore();
    }

    function isInRange(value1, value2) {
        value1 = Math.round(value1);
        value2 = Math.round(value2);
        for (var i = value1 - aligningLineMargin, len = value1 + aligningLineMargin; i <= len; i++) {
            if (i === value2) {
                return true;
            }
        }
        return false;
    }

    var verticalLines = [],
        horizontalLines = [];

    canvas.on('mouse:down', function () {
        viewportTransform = canvas.viewportTransform;
        zoom = canvas.getZoom();
    });

    canvas.on('object:moving', function(e) {
        var activeObject = e.target,
            canvasObjects = canvas.getObjects(),
            activeObjectCenter = activeObject.getCenterPoint(),
            activeObjectBoundingRect = activeObject.getBoundingRect(),
            activeObjectHeight = activeObjectBoundingRect.height / viewportTransform[3],
            activeObjectWidth = activeObjectBoundingRect.width / viewportTransform[0],
            horizontalInTheRange = false,
            verticalInTheRange = false,
            transform = canvas._currentTransform;

        if (!transform) return;

        verticalLines.length = horizontalLines.length = 0;

        for (var i = canvasObjects.length; i--; ) {
            if (canvasObjects[i] === activeObject) continue;

            var objectBoundingRect = canvasObjects[i].getBoundingRect(),
                objectHeight = objectBoundingRect.height / viewportTransform[3],
                objectWidth = objectBoundingRect.width / viewportTransform[0],
                objectCenter = canvasObjects[i].getCenterPoint();

            // Snap center
            if (isInRange(objectCenter.x, activeObjectCenter.x)) {
                verticalInTheRange = true;
                verticalLines.push({
                    x: objectCenter.x,
                    y1: (objectCenter.y < activeObjectCenter.y) ?
                        (objectCenter.y - objectHeight / 2 - aligningLineOffset) :
                        (objectCenter.y + objectHeight / 2 + aligningLineOffset),
                    y2: (activeObjectCenter.y > objectCenter.y) ?
                        (activeObjectCenter.y + activeObjectHeight / 2 + aligningLineOffset) :
                        (activeObjectCenter.y - activeObjectHeight / 2 - aligningLineOffset)
                });
                activeObject.setPositionByOrigin(new fabric.Point(objectCenter.x, activeObjectCenter.y), 'center', 'center');
            }

            // Snap left
            if (isInRange(objectBoundingRect.left, activeObjectBoundingRect.left)) {
                verticalInTheRange = true;
                verticalLines.push({
                    x: objectBoundingRect.left,
                    y1: (objectCenter.y < activeObjectCenter.y) ?
                        (objectCenter.y - objectHeight / 2 - aligningLineOffset) :
                        (objectCenter.y + objectHeight / 2 + aligningLineOffset),
                    y2: (activeObjectCenter.y > objectCenter.y) ?
                        (activeObjectCenter.y + activeObjectHeight / 2 + aligningLineOffset) :
                        (activeObjectCenter.y - activeObjectHeight / 2 - aligningLineOffset)
                });
                activeObject.setPositionByOrigin(new fabric.Point(objectBoundingRect.left + activeObjectWidth / 2, activeObjectCenter.y), 'center', 'center');
            }

            // Snap right
            if (isInRange(objectBoundingRect.left + objectBoundingRect.width, activeObjectBoundingRect.left + activeObjectBoundingRect.width)) {
                verticalInTheRange = true;
                verticalLines.push({
                    x: objectBoundingRect.left + objectBoundingRect.width,
                    y1: (objectCenter.y < activeObjectCenter.y) ?
                        (objectCenter.y - objectHeight / 2 - aligningLineOffset) :
                        (objectCenter.y + objectHeight / 2 + aligningLineOffset),
                    y2: (activeObjectCenter.y > objectCenter.y) ?
                        (activeObjectCenter.y + activeObjectHeight / 2 + aligningLineOffset) :
                        (activeObjectCenter.y - activeObjectHeight / 2 - aligningLineOffset)
                });
                activeObject.setPositionByOrigin(new fabric.Point(objectBoundingRect.left + objectBoundingRect.width - activeObjectWidth / 2, activeObjectCenter.y), 'center', 'center');
            }

            // Horizontal snapping
            if (isInRange(objectCenter.y, activeObjectCenter.y)) {
                horizontalInTheRange = true;
                horizontalLines.push({
                    y: objectCenter.y,
                    x1: (objectCenter.x < activeObjectCenter.x) ?
                        (objectCenter.x - objectWidth / 2 - aligningLineOffset) :
                        (objectCenter.x + objectWidth / 2 + aligningLineOffset),
                    x2: (activeObjectCenter.x > objectCenter.x) ?
                        (activeObjectCenter.x + activeObjectWidth / 2 + aligningLineOffset) :
                        (activeObjectCenter.x - activeObjectWidth / 2 - aligningLineOffset)
                });
                activeObject.setPositionByOrigin(new fabric.Point(activeObjectCenter.x, objectCenter.y), 'center', 'center');
            }
        }

        // Snap to center of canvas
        var canvasCenter = { x: canvas.width / 2, y: canvas.height / 2 };

        if (isInRange(canvasCenter.x, activeObjectCenter.x)) {
            verticalInTheRange = true;
            verticalLines.push({
                x: canvasCenter.x,
                y1: 0,
                y2: canvas.height
            });
            activeObject.setPositionByOrigin(new fabric.Point(canvasCenter.x, activeObjectCenter.y), 'center', 'center');
        }

        if (isInRange(canvasCenter.y, activeObjectCenter.y)) {
            horizontalInTheRange = true;
            horizontalLines.push({
                y: canvasCenter.y,
                x1: 0,
                x2: canvas.width
            });
            activeObject.setPositionByOrigin(new fabric.Point(activeObjectCenter.x, canvasCenter.y), 'center', 'center');
        }

        if (!horizontalInTheRange) horizontalLines.length = 0;
        if (!verticalInTheRange) verticalLines.length = 0;
    });

    canvas.on('before:render', function() {
        if(canvas.contextTop) canvas.clearContext(canvas.contextTop);
    });

    canvas.on('after:render', function() {
        for (var i = verticalLines.length; i--; ) {
            drawVerticalLine(verticalLines[i]);
        }
        for (var i = horizontalLines.length; i--; ) {
            drawHorizontalLine(horizontalLines[i]);
        }
        verticalLines.length = horizontalLines.length = 0;
    });

    canvas.on('mouse:up', function() {
        verticalLines.length = horizontalLines.length = 0;
        canvas.renderAll();
    });
}
initAligningGuidelines(canvas);
// ======================== MENÚ CONTEXTUAL (CLIC DERECHO) ========================
const contextMenu = document.getElementById('contextMenu');

window.addEventListener('click', (e) => {
    if (!contextMenu.classList.contains('hidden')) {
        contextMenu.classList.add('hidden');
    }
});

canvas.upperCanvasEl.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    
    // Encontrar objeto bajo el cursor
    const pointer = canvas.getPointer(e);
    const objects = canvas.getObjects();
    let targetObj = null;
    
    for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].containsPoint(pointer)) {
            targetObj = objects[i];
            break;
        }
    }
    
    if (targetObj) {
        canvas.setActiveObject(targetObj);
        canvas.requestRenderAll();
        updatePropertiesPanel();
        
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.classList.remove('hidden');
    } else {
        contextMenu.classList.add('hidden');
    }
});

document.getElementById('ctxCopy').addEventListener('click', () => {
    document.getElementById('btnDuplicate').click();
});

document.getElementById('ctxBringFront').addEventListener('click', () => {
    document.getElementById('btnBringFront').click();
});

document.getElementById('ctxSendBack').addEventListener('click', () => {
    document.getElementById('btnSendBack').click();
});

document.getElementById('ctxDelete').addEventListener('click', () => {
    const activeObj = canvas.getActiveObject();
    if(activeObj) {
        canvas.remove(activeObj);
        canvas.discardActiveObject();
    }
});