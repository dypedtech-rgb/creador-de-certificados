/**
 * export.js - Lógica de exportación con pdf-lib y JSZip
 */

const exportModal = document.getElementById('exportModal');
const exportNameCol = document.getElementById('exportNameCol');
const btnOpenExport = document.getElementById('btnOpenExport');
const btnExportCurrent = document.getElementById('btnExportCurrent'); // Desde la pestaña previsualización
const closeExportModal = document.getElementById('closeExportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const startExportBtn = document.getElementById('startExportBtn');

const exportRadioScope = document.getElementsByName('exportScope');
const rangeInputs = document.getElementById('rangeInputs');
const exportFrom = document.getElementById('exportFrom');
const exportTo = document.getElementById('exportTo');
const exportScale = document.getElementById('exportScale');

const exportProgressWrap = document.getElementById('exportProgressWrap');
const exportProgressBar = document.getElementById('exportProgressBar');
const exportProgressText = document.getElementById('exportProgressText');

// ======================== MODAL UI ========================
function openExportModal() {
    if (!window.AppState.pdfBytes) return window.showToast('Debes cargar una plantilla PDF primero.', 'error');
    if (!window.AppState.excelData || window.AppState.excelData.length === 0) return window.showToast('Debes cargar un Excel con datos primero.', 'error');
    
    // Poblar select de nombre
    exportNameCol.innerHTML = '<option value="_index">Usar número (certificado_1.pdf, certificado_2.pdf...)</option>';
    window.AppState.columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        exportNameCol.appendChild(opt);
    });
    
    if (window.AppState.nameColumn) {
        exportNameCol.value = window.AppState.nameColumn;
    }
    
    exportModal.classList.remove('hidden');
    exportProgressWrap.classList.add('hidden');
}

btnOpenExport.addEventListener('click', openExportModal);
btnExportCurrent.addEventListener('click', () => {
    document.getElementById('exportCurrent').checked = true;
    openExportModal();
});

const closeExport = () => exportModal.classList.add('hidden');
closeExportModal.addEventListener('click', closeExport);
cancelExportBtn.addEventListener('click', closeExport);

// Toggle range inputs
exportRadioScope.forEach(radio => {
    radio.addEventListener('change', () => {
        if (document.getElementById('exportRange').checked) {
            rangeInputs.classList.remove('hidden');
        } else {
            rangeInputs.classList.add('hidden');
        }
    });
});

// ======================== LÓGICA DE EXPORTACIÓN ========================

startExportBtn.addEventListener('click', async () => {
    const scope = Array.from(exportRadioScope).find(r => r.checked).value;
    const data = window.AppState.excelData;
    let indicesToExport = [];
    
    if (scope === 'all') {
        indicesToExport = data.map((_, i) => i);
    } else if (scope === 'current') {
        if (window.AppState.activeParticipantIndex >= 0) {
            indicesToExport = [window.AppState.activeParticipantIndex];
        } else {
            return window.showToast('No hay un participante actual previsualizado', 'error');
        }
    } else if (scope === 'range') {
        const from = parseInt(exportFrom.value) - 1;
        const to = parseInt(exportTo.value) - 1;
        if (isNaN(from) || isNaN(to) || from < 0 || to >= data.length || from > to) {
            return window.showToast('Rango inválido', 'error');
        }
        for (let i = from; i <= to; i++) {
            indicesToExport.push(i);
        }
    }
    
    if (indicesToExport.length === 0) return window.showToast('No hay nada que exportar', 'error');
    
    const scaleMultiplier = parseInt(exportScale.value) || 2;
    const useZip = indicesToExport.length > 1;
    let zip;
    if (useZip) {
        zip = new JSZip();
    }
    
    startExportBtn.disabled = true;
    cancelExportBtn.disabled = true;
    exportProgressWrap.classList.remove('hidden');
    
    const canvas = window.fabricCanvas;
    // Deseleccionar objetos para que no salgan los bordes de selección en el PDF
    canvas.discardActiveObject();
    
    // Guardar fondo original
    const originalBackground = canvas.backgroundImage;
    // Ocultar fondo para exportar solo los elementos superpuestos con transparencia
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    
    // Guardar textos originales para restaurarlos al final
    const originalTexts = new Map();
    canvas.getObjects().forEach(obj => {
        if (obj.type === 'i-text' && obj.customData && obj.customData.isColumnBound) {
            originalTexts.set(obj, obj.text);
        }
    });

    try {
        const pdfBytesOriginal = window.AppState.pdfBytes;
        
        for (let i = 0; i < indicesToExport.length; i++) {
            const rowIndex = indicesToExport[i];
            const rowData = data[rowIndex];
            
            // Actualizar progreso
            const percent = Math.round(((i) / indicesToExport.length) * 100);
            exportProgressBar.style.width = `${percent}%`;
            exportProgressText.textContent = `Generando ${i + 1} de ${indicesToExport.length}...`;
            
            // Permitir que el UI se actualice
            await new Promise(r => setTimeout(r, 10));
            
            // 1. Reemplazar textos
            canvas.getObjects().forEach(obj => {
                if (obj.type === 'i-text' && obj.customData && obj.customData.isColumnBound) {
                    const col = obj.customData.columnName;
                    obj.set('text', String(rowData[col] || ''));
                }
            });
            canvas.renderAll();
            
            // 2. Exportar canvas como imagen PNG transparente
            // Multiplicamos por la escala seleccionada para mayor calidad
            const dataUrl = canvas.toDataURL({
                format: 'png',
                multiplier: scaleMultiplier
            });
            
            // 3. Cargar PDF original con pdf-lib
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytesOriginal);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            
            // 4. Incrustar imagen generada encima
            const pngImage = await pdfDoc.embedPng(dataUrl);
            const { width, height } = firstPage.getSize();
            
            firstPage.drawImage(pngImage, {
                x: 0,
                y: 0,
                width: width,
                height: height
            });
            
            // 5. Generar bytes finales
            const pdfBytesFinal = await pdfDoc.save();
            
            // 6. Nombre del archivo
            let fileName = `certificado_${rowIndex + 1}.pdf`;
            const nameCol = exportNameCol.value;
            if (nameCol !== '_index' && rowData[nameCol]) {
                // Limpiar caracteres inválidos para nombres de archivo
                const safeName = String(rowData[nameCol]).replace(/[<>:"\/\\|?*]+/g, '').trim();
                if(safeName) fileName = `${safeName}.pdf`;
            }
            
            if (useZip) {
                zip.file(fileName, pdfBytesFinal);
            } else {
                // Descarga directa
                const blob = new Blob([pdfBytesFinal], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 100);
            }
        }
        
        exportProgressBar.style.width = `100%`;
        exportProgressText.textContent = `Finalizando...`;
        
        if (useZip) {
            await new Promise(r => setTimeout(r, 100)); // Pequeña pausa
            exportProgressText.textContent = `Comprimiendo archivo ZIP...`;
            const zipContent = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipContent);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'certificados_exportados.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }
        
        window.showToast('Exportación completada', 'success');
        
    } catch (err) {
        console.error(err);
        window.showToast('Ocurrió un error durante la exportación', 'error');
    } finally {
        // Restaurar estado del canvas
        canvas.setBackgroundImage(originalBackground, canvas.renderAll.bind(canvas));
        canvas.getObjects().forEach(obj => {
            if (originalTexts.has(obj)) {
                obj.set('text', originalTexts.get(obj));
            }
        });
        canvas.renderAll();
        
        startExportBtn.disabled = false;
        cancelExportBtn.disabled = false;
        setTimeout(() => {
            exportModal.classList.add('hidden');
        }, 1000);
    }
});
