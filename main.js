const { app, BrowserWindow, Menu, ipcMain, session } = require('electron');
const path = require('path');
const express = require('express');
const os = require('os');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const appWeb = express();
let io;
let server;

appWeb.use(cors({ origin: '*' }));

appWeb.get("/", (req, res) => {
    res.send("Servidor en funcionamiento");
});

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
        for (let alias of interfaces[iface]) {
            if (alias.family === 'IPv4' && !alias.internal) {
                if (!alias.address.startsWith('169.254') && alias.address.startsWith('192.168') &&
                    !/Virtual|VMware|Loopback|Docker|vEthernet/.test(iface) &&
                    (alias.mac !== '00:00:00:00:00:00' && alias.mac !== '00:00:00:00:00:00')) {
                    return alias.address;
                }
            }
        }
    }
    return 'IP no disponible';
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false, // Permite el acceso a recursos locales, puede ser inseguro.
            media: {
                audio: true, // Asegura el acceso a dispositivos de audio.
                video: false
            }
        }
    });

    mainWindow.loadFile('index.html');

    const localIP = getLocalIPAddress();
    const hostname = os.hostname();
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('info', { ip: localIP, hostname: hostname });
    });
}

app.whenReady().then(() => {
    createWindow();
    const menu = Menu.buildFromTemplate([
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle DevTools',
                    accelerator: 'CmdOrCtrl+I',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) {
                            focusedWindow.webContents.toggleDevTools();
                        }
                    }
                }
            ]
        }
    ]);

    Menu.setApplicationMenu(menu);

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true); // Permitir el acceso a medios (audio y video)
        } else {
            callback(false);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('start-servers', (event, arg) => {
    console.log('Iniciando servidores...');

    server = http.createServer(appWeb);

    server.listen(3000, () => {
        console.log('Servidor HTTP escuchando en el puerto 3000');
    });

    io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        }
    });

    io.on('connection', (socket) => {
      console.log('Dispositivo conectado con ID:', socket.id);
  
      socket.on('phone-connected', (peersId) => {
          console.log("Nuevo dispositivo conectado con ID: " + peersId);
          io.emit('phone-connected', peersId); // Reenviar a todos los clientes de escritorio
      });
  
      socket.on('phone-disconnected', () => {
          io.emit('phone-disconnected'); // Reenviar a todos los clientes de escritorio
      });
  
      socket.on('message', function(message) {
          console.log('Client said: ', message);
          io.emit('message', message); // Reenviar el mensaje a todos los clientes
      });
  
      socket.on('disconnect', () => {
          console.log('Dispositivo desconectado');
          io.emit('phone-disconnected'); // Reenviar a todos los clientes de escritorio
      });

      socket.on('expel-device', (targetSocketId) => {
        io.to(targetSocketId).emit('expel');
    });
  });
  

    event.reply('servers-started', 'Los servidores están en funcionamiento.');
});

ipcMain.on('stop-servers', (event, arg) => {
    console.log('Deteniendo servidores...');

    if (server) {
        server.close(() => {
            console.log('Servidor HTTP detenido');
        });
    }

    if (io) {
        io.close(() => {
            console.log('Servidor Socket.IO detenido');
        });
    }

    event.reply('servers-stopped', 'Los servidores han sido detenidos.');
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
