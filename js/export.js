/**
 * export.js - Exportación Vectorial con pdf-lib, IDs únicos y CSV de trazabilidad
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

// Mapa de URLs TTF para incrustar fuentes como vectores en el PDF
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
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 0, g: 0, b: 0 };
}

function generateUniqueId() {
    const part1 = Math.random().toString(36).substr(2, 8).toUpperCase();
    const part2 = Date.now().toString(36).substr(-4).toUpperCase();
    return `CERT-${part1}-${part2}`;
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

// ======================== EXPORTACIÓN VECTORIAL ========================
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
            return window.showToast('No hay un participante actual', 'error');
        }
    } else if (scope === 'range') {
        const from = parseInt(exportFrom.value) - 1;
        const to = parseInt(exportTo.value) - 1;
        if (isNaN(from) || isNaN(to) || from < 0 || to >= data.length || from > to) {
            return window.showToast('Rango inválido', 'error');
        }
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

    // Guardar textos originales para restaurar al final
    const originalTexts = new Map();
    canvas.getObjects().forEach(obj => {
        if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.customData && obj.customData.isColumnBound) {
            originalTexts.set(obj, obj.text);
        }
    });

    // CSV de trazabilidad
    let trackingCsv = 'Archivo PDF,ID Único,Participante\n';

    try {
        const pdfBytesOriginal = window.AppState.pdfBytes;

        for (let i = 0; i < indicesToExport.length; i++) {
            const rowIndex = indicesToExport[i];
            const rowData = data[rowIndex];

            const percent = Math.round((i / indicesToExport.length) * 100);
            exportProgressBar.style.width = `${percent}%`;
            exportProgressText.textContent = `Generando ${i + 1} de ${indicesToExport.length}...`;
            await new Promise(r => setTimeout(r, 10));

            // 1. Reemplazar textos vinculados con datos del participante
            canvas.getObjects().forEach(obj => {
                if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.customData && obj.customData.isColumnBound) {
                    obj.set('text', String(rowData[obj.customData.columnName] || ''));
                }
            });
            canvas.renderAll();

            // 2. Cargar PDF original
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytesOriginal);
            if (window.fontkit) pdfDoc.registerFontkit(window.fontkit);

            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width: pdfW, height: pdfH } = firstPage.getSize();

            const scaleX = pdfW / canvas.width;
            const scaleY = pdfH / canvas.height;

            // 3. Dibujar cada objeto vectorialmente
            for (const obj of canvas.getObjects()) {
                if (obj.type === 'textbox' || obj.type === 'i-text') {
                    const textLines = obj.textLines || [obj.text];
                    const fontSize = obj.fontSize * scaleY;
                    const rgb = hexToRgb(obj.fill || '#000000');

                    // Obtener fuente vectorial
                    let pdfFont;
                    if (fontUrls[obj.fontFamily] && window.fontkit) {
                        try {
                            if (!fontCache[obj.fontFamily]) {
                                const fontBytes = await fetch(fontUrls[obj.fontFamily]).then(res => res.arrayBuffer());
                                fontCache[obj.fontFamily] = fontBytes;
                            }
                            pdfFont = await pdfDoc.embedFont(fontCache[obj.fontFamily]);
                        } catch (e) {
                            pdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
                        }
                    } else {
                        pdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
                    }

                    const tl = obj.aCoords ? obj.aCoords.tl : { x: obj.left, y: obj.top };
                    const boxWidth = (obj.width || 300) * scaleX;

                    for (let j = 0; j < textLines.length; j++) {
                        const lineText = textLines[j];
                        if (!lineText) continue;

                        const textWidth = pdfFont.widthOfTextAtSize(lineText, fontSize);

                        let lineX;
                        if (obj.textAlign === 'center') {
                            lineX = tl.x * scaleX + (boxWidth / 2) - (textWidth / 2);
                        } else if (obj.textAlign === 'right') {
                            lineX = tl.x * scaleX + boxWidth - textWidth;
                        } else {
                            lineX = tl.x * scaleX;
                        }

                        const lineOffset = j * (obj.lineHeight || 1.2) * fontSize;
                        const lineY = tl.y * scaleY + lineOffset + fontSize;

                        firstPage.drawText(lineText, {
                            x: Math.max(0, lineX),
                            y: Math.max(0, pdfH - lineY + (fontSize * 0.15)),
                            size: fontSize,
                            font: pdfFont,
                            color: PDFLib.rgb(rgb.r / 255, rgb.g / 255, rgb.b / 255)
                        });
                    }
                } else if (obj.type === 'line') {
                    const rgb = hexToRgb(obj.stroke || '#000000');
                    const p1 = fabric.util.transformPoint({ x: obj.x1, y: obj.y1 }, obj.calcTransformMatrix());
                    const p2 = fabric.util.transformPoint({ x: obj.x2, y: obj.y2 }, obj.calcTransformMatrix());

                    firstPage.drawLine({
                        start: { x: p1.x * scaleX, y: pdfH - (p1.y * scaleY) },
                        end: { x: p2.x * scaleX, y: pdfH - (p2.y * scaleY) },
                        thickness: obj.strokeWidth * scaleY,
                        color: PDFLib.rgb(rgb.r / 255, rgb.g / 255, rgb.b / 255),
                        dashArray: obj.strokeDashArray ? obj.strokeDashArray.map(v => v * scaleX) : undefined
                    });
                } else if (obj.type === 'image') {
                    try {
                        const dataUrl = obj.toDataURL({ format: 'png' });
                        const pngImage = await pdfDoc.embedPng(dataUrl);
                        const tl = obj.aCoords ? obj.aCoords.tl : { x: obj.left, y: obj.top };
                        const w = (obj.width * obj.scaleX) * scaleX;
                        const h = (obj.height * obj.scaleY) * scaleY;
                        firstPage.drawImage(pngImage, {
                            x: tl.x * scaleX,
                            y: pdfH - (tl.y * scaleY) - h,
                            width: w,
                            height: h
                        });
                    } catch (imgErr) {
                        console.warn('Could not embed image:', imgErr);
                    }
                }
            }

            // 4. Estampar ID único en esquina inferior izquierda
            const uniqueId = generateUniqueId();
            const idFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            firstPage.drawText(`ID: ${uniqueId}`, {
                x: 15,
                y: 15,
                size: 8,
                font: idFont,
                color: PDFLib.rgb(0.45, 0.45, 0.45)
            });

            // 5. Guardar PDF
            const pdfBytesFinal = await pdfDoc.save();

            // 6. Nombre del archivo
            let fileName = `certificado_${rowIndex + 1}.pdf`;
            const nameCol = exportNameCol.value;
            if (nameCol !== '_index' && rowData[nameCol]) {
                const safeName = String(rowData[nameCol]).replace(/[<>:"\/\\|?*]+/g, '').trim();
                if (safeName) fileName = `${safeName}.pdf`;
            }

            // 7. Añadir al CSV de trazabilidad
            const participantName = rowData[exportNameCol.value] || `Participante_${rowIndex + 1}`;
            trackingCsv += `"${fileName}","${uniqueId}","${participantName}"\n`;

            if (useZip) {
                zip.file(fileName, pdfBytesFinal);
            } else {
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

        exportProgressBar.style.width = '100%';
        exportProgressText.textContent = 'Finalizando...';

        if (useZip) {
            await new Promise(r => setTimeout(r, 100));
            exportProgressText.textContent = 'Comprimiendo archivo ZIP...';
            // Añadir el CSV de registro de IDs
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const csvBlob = new Blob([bom, trackingCsv], { type: 'text/csv;charset=utf-8' });
            zip.file('registro_ids_certificados.csv', csvBlob);
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

        window.showToast('Exportación completada con éxito ✓', 'success');

    } catch (err) {
        console.error('Export error:', err);
        window.showToast(`Error al exportar: ${err.message}`, 'error');
    } finally {
        // Restaurar textos originales
        canvas.getObjects().forEach(obj => {
            if (originalTexts.has(obj)) {
                obj.set('text', originalTexts.get(obj));
            }
        });
        canvas.renderAll();
        startExportBtn.disabled = false;
        cancelExportBtn.disabled = false;
        setTimeout(() => exportModal.classList.add('hidden'), 1500);
    }
});