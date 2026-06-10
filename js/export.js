/**
 * export.js - Lógica de exportación con pdf-lib (Renderizado Vectorial) y JSZip
 */

const exportModal = document.getElementById('exportModal');
const exportNameCol = document.getElementById('exportNameCol');
const btnOpenExport = document.getElementById('btnOpenExport');
const btnExportCurrent = document.getElementById('btnExportCurrent');
const closeExportModal = document.getElementById('closeExportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const startExportBtn = document.getElementById('startExportBtn');

const exportRadioScope = document.getElementsByName('exportScope');
const rangeInputs = document.getElementById('rangeInputs');
const exportFrom = document.getElementById('exportFrom');
const exportTo = document.getElementById('exportTo');

const exportProgressWrap = document.getElementById('exportProgressWrap');
const exportProgressBar = document.getElementById('exportProgressBar');
const exportProgressText = document.getElementById('exportProgressText');

// Fuentes TTF para Vectorización
const fontUrls = {
    'Inter': 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf',
    'Montserrat': 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
    'Roboto Condensed': 'https://raw.githubusercontent.com/google/fonts/main/ofl/robotocondensed/RobotoCondensed%5Bwght%5D.ttf',
    'Oswald': 'https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf',
    'Fira Sans Condensed': 'https://raw.githubusercontent.com/google/fonts/main/ofl/firasanscondensed/FiraSansCondensed-Regular.ttf',
    'Anton': 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf'
};

const fontCache = {};

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// ======================== MODAL UI ========================
function openExportModal() {
    if (!window.AppState.pdfBytes) return window.showToast('Debes cargar una plantilla PDF primero.', 'error');
    if (!window.AppState.excelData || window.AppState.excelData.length === 0) return window.showToast('Debes cargar un Excel con datos primero.', 'error');
    
    exportNameCol.innerHTML = '<option value="_index">Usar número (certificado_1.pdf...)</option>';
    window.AppState.columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        exportNameCol.appendChild(opt);
    });
    
    if (window.AppState.nameColumn) exportNameCol.value = window.AppState.nameColumn;
    
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

exportRadioScope.forEach(radio => {
    radio.addEventListener('change', () => {
        if (document.getElementById('exportRange').checked) rangeInputs.classList.remove('hidden');
        else rangeInputs.classList.add('hidden');
    });
});

// ======================== LÓGICA DE EXPORTACIÓN VECTORIAL ========================

startExportBtn.addEventListener('click', async () => {
    const scope = Array.from(exportRadioScope).find(r => r.checked).value;
    const data = window.AppState.excelData;
    let indicesToExport = [];
    
    if (scope === 'all') indicesToExport = data.map((_, i) => i);
    else if (scope === 'current') {
        if (window.AppState.activeParticipantIndex >= 0) indicesToExport = [window.AppState.activeParticipantIndex];
        else return window.showToast('No hay un participante actual', 'error');
    } else if (scope === 'range') {
        const from = parseInt(exportFrom.value) - 1;
        const to = parseInt(exportTo.value) - 1;
        if (isNaN(from) || isNaN(to) || from < 0 || to >= data.length || from > to) return window.showToast('Rango inválido', 'error');
        for (let i = from; i <= to; i++) indicesToExport.push(i);
    }
    
    if (indicesToExport.length === 0) return window.showToast('No hay nada que exportar', 'error');
    
    const useZip = indicesToExport.length > 1;
    let zip;
    if (useZip) zip = new JSZip();
    
    startExportBtn.disabled = true;
    cancelExportBtn.disabled = true;
    exportProgressWrap.classList.remove('hidden');
    
    const canvas = window.fabricCanvas;
    canvas.discardActiveObject();
    
    const originalTexts = new Map();
    canvas.getObjects().forEach(obj => {
        if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.customData && obj.customData.isColumnBound) {
            originalTexts.set(obj, obj.text);
        }
    });

    try {
        const pdfBytesOriginal = window.AppState.pdfBytes;
        let trackingCsv = "Certificado Archivo,ID Único,Nombre/Participante\n";
        
        for (let i = 0; i < indicesToExport.length; i++) {
            const rowIndex = indicesToExport[i];
            const rowData = data[rowIndex];
            
            const percent = Math.round(((i) / indicesToExport.length) * 100);
            exportProgressBar.style.width = `${percent}%`;
            exportProgressText.textContent = `Generando vectorialmente ${i + 1} de ${indicesToExport.length}...`;
            await new Promise(r => setTimeout(r, 10));
            
            // 1. Reemplazar textos
            canvas.getObjects().forEach(obj => {
                if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.customData && obj.customData.isColumnBound) {
                    const col = obj.customData.columnName;
                    obj.set('text', String(rowData[col] || ''));
                }
            });
            canvas.renderAll();
            
            // 2. Cargar PDF original
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytesOriginal);
            if (window.fontkit) pdfDoc.registerFontkit(window.fontkit);
            
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();
            
            const scaleX = width / canvas.width;
            const scaleY = height / canvas.height;
            
            // 3. Dibujar objetos vectoriales
            const objects = canvas.getObjects();
            for (let obj of objects) {
                if (obj.type === 'textbox' || obj.type === 'i-text') {
                    const textLines = obj.textLines || [obj.text];
                    const fontSize = obj.fontSize * scaleY;
                    const rgb = hexToRgb(obj.fill || '#000000');
                    
                    let pdfFont;
                    if (fontUrls[obj.fontFamily] && window.fontkit) {
                        if (!fontCache[obj.fontFamily]) {
                            const fontBytes = await fetch(fontUrls[obj.fontFamily]).then(res => res.arrayBuffer());
                            fontCache[obj.fontFamily] = fontBytes;
                        }
                        pdfFont = await pdfDoc.embedFont(fontCache[obj.fontFamily]);
                    } else {
                        pdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
                    }
                    
                    const tl = obj.aCoords.tl;
                    for (let j = 0; j < textLines.length; j++) {
                        const lineText = textLines[j];
                        
                        let lineX = tl.x;
                        const textWidth = pdfFont.widthOfTextAtSize(lineText, fontSize);
                        const boxWidth = (obj.width || 0) * scaleX;
                        
                        if (obj.textAlign === 'center') {
                            lineX = tl.x * scaleX + (boxWidth / 2) - (textWidth / 2);
                        } else if (obj.textAlign === 'right') {
                            lineX = tl.x * scaleX + boxWidth - textWidth;
                        } else {
                            lineX = tl.x * scaleX;
                        }
                        
                        const lineOffset = j * (obj.lineHeight * obj.fontSize * scaleY);
                        // PDF uses bottom-left origin. Fabric uses top-left.
                        const lineY = (tl.y * scaleY) + lineOffset + fontSize;
                        
                        firstPage.drawText(lineText, {
                            x: lineX,
                            y: height - lineY + (fontSize * 0.2), // Adjust baseline slightly
                            size: fontSize,
                            font: pdfFont,
                            color: PDFLib.rgb(rgb.r/255, rgb.g/255, rgb.b/255)
                        });
                    }
                } else if (obj.type === 'line') {
                    const rgb = hexToRgb(obj.stroke || '#000000');
                    // Calculate exact points based on transformation matrix
                    const p1 = fabric.util.transformPoint({x: obj.x1, y: obj.y1}, obj.calcTransformMatrix());
                    const p2 = fabric.util.transformPoint({x: obj.x2, y: obj.y2}, obj.calcTransformMatrix());
                    
                    firstPage.drawLine({
                        start: { x: p1.x * scaleX, y: height - (p1.y * scaleY) },
                        end: { x: p2.x * scaleX, y: height - (p2.y * scaleY) },
                        thickness: obj.strokeWidth * scaleY,
                        color: PDFLib.rgb(rgb.r/255, rgb.g/255, rgb.b/255),
                        dashArray: obj.strokeDashArray ? obj.strokeDashArray.map(v => v * scaleX) : undefined
                    });
                } else if (obj.type === 'image') {
                    // Exportar imagen desde fabric
                    const dataUrl = obj.toDataURL({ format: 'png' });
                    const pngImage = await pdfDoc.embedPng(dataUrl);
                    const tl = obj.aCoords.tl;
                    const w = (obj.width * obj.scaleX) * scaleX;
                    const h = (obj.height * obj.scaleY) * scaleY;
                    firstPage.drawImage(pngImage, {
                        x: tl.x * scaleX,
                        y: height - (tl.y * scaleY) - h,
                        width: w,
                        height: h
                    });
                }
            }
            
            const pdfBytesFinal = await pdfDoc.save();
            
            let fileName = certificado_.pdf;
            const nameCol = exportNameCol.value;
            if (nameCol !== '_index' && rowData[nameCol]) {
                const safeName = String(rowData[nameCol]).replace(/[<>:"\/\\|?*]+/g, '').trim();
                if(safeName) fileName = ${safeName}.pdf;
            }
            
            const participantName = rowData[exportNameCol.value] || 'Desconocido';
            trackingCsv += "${fileName}","",""\n;

            if (useZip) zip.file(fileName, pdfBytesFinal);
            else {
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
        
        exportProgressBar.style.width = 100%;
        exportProgressText.textContent = Finalizando...;
        
        if (useZip) {
            await new Promise(r => setTimeout(r, 100));
            exportProgressText.textContent = Comprimiendo archivo ZIP...;
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
        
        window.showToast('Exportación Vectorial completada', 'success');
        
    } catch (err) {
        console.error(err);
        window.showToast('Ocurrió un error durante la exportación', 'error');
    } finally {
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