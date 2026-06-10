/**
 * excel.js - Lógica para manejar datos de Excel, columnas y participantes
 */

const excelDropZone = document.getElementById('excelDropZone');
const excelInput = document.getElementById('excelInput');
const excelInfo = document.getElementById('excelInfo');
const excelFileName = document.getElementById('excelFileName');
const excelFileMeta = document.getElementById('excelFileMeta');
const btnClearExcel = document.getElementById('btnClearExcel');

const columnSelectorSection = document.getElementById('columnSelectorSection');
const nameColumnSelect = document.getElementById('nameColumnSelect');
const columnsList = document.getElementById('columnsList');
const columnBindSelect = document.getElementById('columnBindSelect');

const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');
const participantSearch = document.getElementById('participantSearch');

const previewSection = document.getElementById('previewSection');
const previewIndex = document.getElementById('previewIndex');

// ======================== CARGA DE EXCEL ========================
function handleExcelFile(file) {
    if (!file) return;
    
    window.showLoader('Leyendo archivo Excel...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Usamos la primera hoja
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir a JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (jsonData.length === 0) {
                window.hideLoader();
                return window.showToast('El archivo Excel está vacío', 'error');
            }
            
            window.AppState.excelFile = file;
            window.AppState.excelData = jsonData;
            window.AppState.columns = Object.keys(jsonData[0]);
            
            // Actualizar UI
            excelDropZone.classList.add('hidden');
            excelInfo.classList.remove('hidden');
            excelFileName.textContent = file.name;
            excelFileMeta.textContent = `${jsonData.length} filas, ${window.AppState.columns.length} columnas`;
            
            columnSelectorSection.classList.remove('hidden');
            
            populateColumns();
            renderParticipants();
            
            window.hideLoader();
            window.showToast('Datos cargados correctamente', 'success');
            
        } catch (err) {
            console.error(err);
            window.hideLoader();
            window.showToast('Error al procesar el Excel', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Eventos Dropzone
excelDropZone.addEventListener('click', (e) => {
    if(e.target.tagName !== 'BUTTON') excelInput.click();
});
document.getElementById('btnPickExcel').addEventListener('click', () => excelInput.click());
excelInput.addEventListener('change', (e) => handleExcelFile(e.target.files[0]));

excelDropZone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropZone.style.borderColor = 'var(--accent-primary)'; });
excelDropZone.addEventListener('dragleave', () => { excelDropZone.style.borderColor = ''; });
excelDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    excelDropZone.style.borderColor = '';
    handleExcelFile(e.dataTransfer.files[0]);
});

btnClearExcel.addEventListener('click', () => {
    window.AppState.excelFile = null;
    window.AppState.excelData = [];
    window.AppState.columns = [];
    window.AppState.nameColumn = "";
    
    excelDropZone.classList.remove('hidden');
    excelInfo.classList.add('hidden');
    columnSelectorSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    
    nameColumnSelect.innerHTML = '<option value="">-- seleccionar --</option>';
    columnBindSelect.innerHTML = '<option value="">Texto libre (sin vincular)</option>';
    columnsList.innerHTML = '';
    participantsList.innerHTML = '';
    participantCount.textContent = '0';
});

// ======================== MANEJO DE COLUMNAS ========================
function populateColumns() {
    // Select de nombre para PDF
    nameColumnSelect.innerHTML = '<option value="">-- seleccionar --</option>';
    columnBindSelect.innerHTML = '<option value="">Texto libre (sin vincular)</option>';
    
    window.AppState.columns.forEach(col => {
        // Option select nombre pdf
        const opt1 = document.createElement('option');
        opt1.value = col;
        opt1.textContent = col;
        nameColumnSelect.appendChild(opt1);
        
        // Option select vincular panel derecho
        const opt2 = document.createElement('option');
        opt2.value = col;
        opt2.textContent = col;
        columnBindSelect.appendChild(opt2);
    });
    
    // Lista de columnas arrastrables (drag & drop o click para añadir)
    columnsList.innerHTML = '';
    window.AppState.columns.forEach(col => {
        const item = document.createElement('div');
        item.className = 'column-item';
        item.draggable = true;
        item.innerHTML = `<span class="col-name">${col}</span>
                          <button class="btn-icon add-col-btn" title="Añadir al canvas">+</button>`;
        
        // Añadir al canvas mediante botón
        item.querySelector('.add-col-btn').addEventListener('click', () => {
            addBoundTextToCanvas(col);
        });
        
        // Soporte básico Drag & Drop
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', col);
        });
        
        columnsList.appendChild(item);
    });
    
    nameColumnSelect.addEventListener('change', (e) => {
        window.AppState.nameColumn = e.target.value;
    });
}

function addBoundTextToCanvas(colName) {
    if(!window.AppState.pdfBytes) return window.showToast('Carga un PDF primero', 'error');
    
    const text = new fabric.IText(`{${colName}}`, {
        left: window.fabricCanvas.width / 2,
        top: window.fabricCanvas.height / 2,
        fontFamily: 'Inter',
        fontSize: 32,
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        customData: {
            isColumnBound: true,
            columnName: colName
        }
    });
    window.fabricCanvas.add(text);
    window.fabricCanvas.setActiveObject(text);
    window.fabricCanvas.requestRenderAll();
    
    // Cambiar a pestaña Archivos para ver las propiedades
    switchTab('files');
}

// Drag & drop sobre canvas
document.getElementById('canvasArea').addEventListener('dragover', (e) => e.preventDefault());
document.getElementById('canvasArea').addEventListener('drop', (e) => {
    e.preventDefault();
    const colName = e.dataTransfer.getData('text/plain');
    if (colName && window.AppState.columns.includes(colName)) {
        // Calcular posición aproximada
        const rect = document.getElementById('certificateCanvas').getBoundingClientRect();
        const canvas = window.fabricCanvas;
        
        // Transformar coord UI a coord Canvas
        const scale = canvas.width / rect.width;
        let x = (e.clientX - rect.left) * scale;
        let y = (e.clientY - rect.top) * scale;
        
        const text = new fabric.IText(`{${colName}}`, {
            left: x,
            top: y,
            fontFamily: 'Inter',
            fontSize: 32,
            fill: '#000000',
            originX: 'center',
            originY: 'center',
            customData: {
                isColumnBound: true,
                columnName: colName
            }
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.requestRenderAll();
        switchTab('files');
    }
});

// ======================== MANEJO DE PARTICIPANTES ========================
function renderParticipants(filter = "") {
    participantsList.innerHTML = '';
    const data = window.AppState.excelData;
    participantCount.textContent = data.length;
    
    const f = filter.toLowerCase();
    
    data.forEach((row, index) => {
        // Representación de texto de la fila para la búsqueda
        const rowString = Object.values(row).join(' ').toLowerCase();
        if (f && !rowString.includes(f)) return;
        
        const div = document.createElement('div');
        div.className = 'participant-item';
        if (window.AppState.activeParticipantIndex === index) div.classList.add('active');
        
        // Mostrar la primera columna (o la columna nombre si está seleccionada)
        const primaryCol = window.AppState.nameColumn || window.AppState.columns[0];
        const primaryText = row[primaryCol] || `Fila ${index + 1}`;
        
        div.innerHTML = `<span class="col-name">${primaryText}</span>`;
        div.addEventListener('click', () => {
            previewParticipant(index);
        });
        
        participantsList.appendChild(div);
    });
}

participantSearch.addEventListener('input', (e) => {
    renderParticipants(e.target.value);
});

// ======================== PREVISUALIZACIÓN ========================
let originalTexts = new Map(); // Para restaurar `{columna}`

function previewParticipant(index) {
    const data = window.AppState.excelData;
    if(index < 0 || index >= data.length) return;
    
    window.AppState.activeParticipantIndex = index;
    renderParticipants(participantSearch.value);
    
    previewSection.classList.remove('hidden');
    previewIndex.textContent = `${index + 1} / ${data.length}`;
    
    const row = data[index];
    const canvas = window.fabricCanvas;
    
    // Guardar los textos originales si es la primera previsualización
    canvas.getObjects().forEach(obj => {
        if (obj.type === 'i-text' && obj.customData && obj.customData.isColumnBound) {
            const col = obj.customData.columnName;
            if(!originalTexts.has(obj)) {
                originalTexts.set(obj, obj.text);
            }
            // Sustituir por el valor
            obj.set('text', String(row[col] || ''));
        }
    });
    
    canvas.requestRenderAll();
}

document.getElementById('btnResetPreview').addEventListener('click', () => {
    window.AppState.activeParticipantIndex = -1;
    renderParticipants(participantSearch.value);
    previewSection.classList.add('hidden');
    
    // Restaurar `{columna}`
    const canvas = window.fabricCanvas;
    canvas.getObjects().forEach(obj => {
        if (originalTexts.has(obj)) {
            obj.set('text', originalTexts.get(obj));
        }
    });
    originalTexts.clear();
    canvas.requestRenderAll();
});

document.getElementById('btnPrevParticipant').addEventListener('click', () => {
    let idx = window.AppState.activeParticipantIndex - 1;
    if(idx < 0) idx = window.AppState.excelData.length - 1;
    previewParticipant(idx);
});

document.getElementById('btnNextParticipant').addEventListener('click', () => {
    let idx = window.AppState.activeParticipantIndex + 1;
    if(idx >= window.AppState.excelData.length) idx = 0;
    previewParticipant(idx);
});

// ======================== UTILIDADES ========================
window.homogenizeNames = function() {
    if(!window.AppState.nameColumn) {
        return window.showToast('Selecciona primero la "Columna de nombre" arriba', 'error');
    }
    
    const col = window.AppState.nameColumn;
    let changed = 0;
    
    window.AppState.excelData.forEach(row => {
        if(row[col] && typeof row[col] === 'string') {
            const words = row[col].toLowerCase().split(' ');
            const titleCase = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            if (row[col] !== titleCase) {
                row[col] = titleCase;
                changed++;
            }
        }
    });
    
    if (changed > 0) {
        renderParticipants(participantSearch.value);
        if (window.AppState.activeParticipantIndex >= 0) {
            previewParticipant(window.AppState.activeParticipantIndex);
        }
        window.showToast(`Se homogeneizaron ${changed} nombres`, 'success');
    } else {
        window.showToast('No se encontraron nombres que arreglar', 'info');
    }
};

window.removeDuplicates = function() {
    if(!window.AppState.nameColumn) {
        return window.showToast('Selecciona primero la "Columna de nombre" arriba', 'error');
    }
    
    const col = window.AppState.nameColumn;
    const seen = new Set();
    const newData = [];
    
    window.AppState.excelData.forEach(row => {
        const val = row[col];
        if(!seen.has(val)) {
            seen.add(val);
            newData.push(row);
        }
    });
    
    const removed = window.AppState.excelData.length - newData.length;
    
    if (removed > 0) {
        window.AppState.excelData = newData;
        if (window.AppState.activeParticipantIndex >= newData.length) {
            document.getElementById('btnResetPreview').click();
        }
        renderParticipants(participantSearch.value);
        window.showToast(`Se eliminaron ${removed} duplicados`, 'success');
    } else {
        window.showToast('No se encontraron duplicados', 'info');
    }
};
