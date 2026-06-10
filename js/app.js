/**
 * app.js - Estado Global y UI General
 */

window.AppState = {
    pdfFile: null,
    pdfBytes: null, // Uint8Array original para pdf-lib
    pdfImageSrc: null, // Renderizado para usar de fondo en Fabric.js
    excelFile: null,
    excelData: [],
    columns: [],
    nameColumn: "",
    activeParticipantIndex: -1
};

// UI Elements
const tabBtnFiles = document.getElementById('tabBtnFiles');
const tabBtnData = document.getElementById('tabBtnData');
const tabFiles = document.getElementById('tabFiles');
const tabData = document.getElementById('tabData');
const toastContainer = document.getElementById('toastContainer');
const globalLoader = document.getElementById('globalLoader');
const globalLoaderText = document.getElementById('globalLoaderText');

// Tabs
function switchTab(tab) {
    if (tab === 'files') {
        tabBtnFiles.classList.add('active');
        tabBtnData.classList.remove('active');
        tabFiles.classList.remove('hidden');
        tabFiles.classList.add('active');
        tabData.classList.add('hidden');
        tabData.classList.remove('active');
    } else {
        tabBtnData.classList.add('active');
        tabBtnFiles.classList.remove('active');
        tabData.classList.remove('hidden');
        tabData.classList.add('active');
        tabFiles.classList.add('hidden');
        tabFiles.classList.remove('active');
    }
}

tabBtnFiles?.addEventListener('click', () => switchTab('files'));
tabBtnData?.addEventListener('click', () => switchTab('data'));

// Toasts
window.showToast = function(message, type = 'info') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    if(type === 'success') icon = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
    else if(type === 'error') icon = '<svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    else icon = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
};

// Loader
window.showLoader = function(text = "Procesando...") {
    if(globalLoader && globalLoaderText) {
        globalLoaderText.textContent = text;
        globalLoader.classList.remove('hidden');
    }
};

window.hideLoader = function() {
    if(globalLoader) {
        globalLoader.classList.add('hidden');
    }
};
