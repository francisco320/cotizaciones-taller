'use strict';

/**
 * main.js — Electron Main Process
 * Aplicación de escritorio offline: Cotizaciones JS
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let Store = null;
try {
    Store = require('electron-store');
    Store = Store?.default || Store;
} catch (err) {
    console.warn('No se pudo cargar electron-store, se usará almacenamiento local simple:', err.message);
}

// Guardar configuración local (ej. carpeta para PDFs)
const PDF_FOLDER_KEY = 'pdf.folder';

function createFallbackStore() {
    const settingsFile = path.join(app.getPath('userData'), 'settings.json');
    let data = {};

    try {
        if (fs.existsSync(settingsFile)) {
            data = JSON.parse(fs.readFileSync(settingsFile, 'utf8') || '{}');
        }
    } catch (err) {
        console.warn('No se pudo leer settings.json:', err.message);
    }

    const save = () => {
        try {
            fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
            fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.warn('No se pudo guardar settings.json:', err.message);
        }
    };

    return {
        get(key) {
            return data[key];
        },
        set(key, value) {
            data[key] = value;
            save();
        },
    };
}

const store = Store ? new Store({ name: 'settings' }) : createFallbackStore();

function getPdfFolder() {
    return store.get(PDF_FOLDER_KEY);
}

function setPdfFolder(folder) {
    if (!folder) return null;
    store.set(PDF_FOLDER_KEY, folder);
    try {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
    } catch (err) {
        console.warn('No se pudo crear la carpeta de PDFs:', err);
    }
    return folder;
}

async function askForPdfFolder(window) {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        title: 'Seleccionar carpeta para guardar PDFs',
        buttonLabel: 'Seleccionar',
        properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || !filePaths || filePaths.length === 0) return null;
    return setPdfFolder(filePaths[0]);
}

async function ensurePdfFolder(window) {
    let folder = getPdfFolder();
    if (folder) {
        try {
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
        } catch {
            // Ignore; fallback to asking user if folder is invalid
            folder = null;
        }
    }

    if (!folder) {
        folder = await askForPdfFolder(window);
    }

    return folder;
}

// Inicializamos la base de datos de inmediato (se conecta en el proceso main)
const db = require('./electron/database');
const { generarPDF } = require('./electron/pdfGenerator');

async function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        show: false, // mostrar solo cuando el contenido esté listo → evita parpadeo
        icon: path.join(
            app.isPackaged ? process.resourcesPath : __dirname,
            'assets',
            'icon.png'
        ),
        webPreferences: {
            preload: path.join(__dirname, 'electron', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,
            allowRunningInsecureContent: true,
        },
    });

    // ── IPC Handlers - SQLite ─────────────────
    ipcMain.handle('cotizaciones:list', (_event, limit, skip) => {
        return db.getCotizaciones(limit, skip);
    });

    ipcMain.handle('cotizaciones:get', (_event, id) => {
        return db.getCotizacionById(id);
    });

    ipcMain.handle('cotizaciones:create', (_event, data) => {
        return db.createCotizacion(data);
    });

    ipcMain.handle('cotizaciones:update', (_event, id, data) => {
        return db.updateCotizacion(id, data);
    });

    ipcMain.handle('cotizaciones:delete', (_event, id) => {
        return db.deleteCotizacion(id);
    });

    // ── IPC Handlers - Archivos y URLs ────────
    ipcMain.handle('open-external', async (_event, url) => {
        if (url.startsWith('https://') || url.startsWith('file://')) {
            await shell.openExternal(url);
        }
    });

    ipcMain.handle('get-pdf-folder', () => {
        return getPdfFolder() || null;
    });

    ipcMain.handle('select-pdf-folder', async () => {
        return await askForPdfFolder(mainWindow);
    });

    // Obtener ruta del PDF para previsualización (generar si no existe)
    ipcMain.handle('get-pdf-path', async (_event, numero) => {
        const pdfDir = path.join(app.getPath('userData'), 'pdfs');

        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }

        const pdfPath = path.join(pdfDir, `cotizacion-${numero}.pdf`);

        if (!fs.existsSync(pdfPath)) {
            const cotizacion = db.getCotizacionByNumero(numero);
            if (cotizacion) {
                await generarPDF(cotizacion, pdfPath);
            }
        }

        const fileBuffer = fs.readFileSync(pdfPath);
        const base64 = fileBuffer.toString('base64');

        return `data:application/pdf;base64,${base64}`;
    });

    // Generar PDF y guardar en la carpeta configurada (o solicitarla la primera vez)
    ipcMain.handle('cotizaciones:pdf', async (_event, id, options = {}) => {
        try {
            const cotizacion = db.getCotizacionById(id);
            if (!cotizacion) throw new Error('Cotización no encontrada');

            // Sugerir nombre de archivo
            const defaultName = `cotizacion-${cotizacion.numeroFormateado}.pdf`;

            // Asegurarse de tener una carpeta configurada (la pedimos la primera vez)
            let pdfFolder = await ensurePdfFolder(mainWindow);

            let userFilePath = null;
            if (pdfFolder) {
                userFilePath = path.join(pdfFolder, defaultName);
                const parentDir = path.dirname(userFilePath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
            }

            // Si el usuario canceló o no hay carpeta configurada, pedimos ruta explícita (solo una vez)
            if (!userFilePath) {
                const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                    title: 'Guardar Cotización',
                    defaultPath: defaultName,
                    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
                });

                if (canceled || !filePath) return null;
                userFilePath = filePath;
            }

            // Siempre guardamos una copia en la carpeta interna para la previsualización
            const internalPath = path.join(app.getPath('userData'), 'pdfs', defaultName);
            await generarPDF(cotizacion, internalPath, options);

            // También generamos el archivo en la ruta elegida por el usuario si es distinta
            if (userFilePath !== internalPath) {
                await generarPDF(cotizacion, userFilePath, options);
            }

            // Intentar abrir el archivo de inmediato
            await shell.openPath(userFilePath);

            return userFilePath;
        } catch (error) {
            console.error('Error generando PDF:', error);
            dialog.showErrorBox('Error al generar PDF', error.message);
            return null;
        }
    });

    // ── Carga de URL / Archivo ─────────────────────
    if (!app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(
            path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
        );
    }

    // Al iniciar, solicitamos la carpeta de PDFs si aún no está configurada.
    // Esto se hace antes de mostrar la ventana para que el usuario la seleccione en el primer arranque.
    await ensurePdfFolder(mainWindow);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Asegurar que existe la carpeta de PDFs en userData
    const pdfsDir = path.join(app.getPath('userData'), 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
    }
}

// ─────────────────────────────────────────────
// 4. CICLO DE VIDA DE LA APLICACIÓN
// ─────────────────────────────────────────────

app.whenReady().then(async () => {
    await createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
