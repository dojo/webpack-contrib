const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
	mainWindow = new BrowserWindow(ELECTRON_BROWSER_OPTIONS);

	if (ELECTRON_WATCH_SERVE) {
		mainWindow.loadURL('http://localhost:' + ELECTRON_SERVE_PORT)
	}
	else {
		mainWindow.loadFile('index.html');
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (mainWindow === null) {
		createWindow();
	}
});
