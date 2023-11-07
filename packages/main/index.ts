import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { release } from 'os'
import { join } from 'path'
import { OzDevice, oxyzen_electron } from 'oxyzen-sdk'
const ppgPrint = console.warn;

const oxyzRequest = 'oxyz-request';
const oxyzResponse = 'oxyz-response';
const oxyzen = oxyzen_electron;

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs')
    },
  })

  ipcMain.on(oxyzRequest, async (event, arg) => {
    console.log('main receive:', arg);
    var cmd = arg.cmd;
    switch (cmd) {
      case 'initSDK':
        await oxyzen.initSDK(false, (e: Error | null) => {
          if (e && e.message) {
            console.error(e.message);
            event.reply(oxyzResponse, { cmd: 'onError', error: e });
          }
        }, (adapterAvailable: boolean) => {
          console.log('adapterAvailable >>>', adapterAvailable);
          event.reply(oxyzResponse, { cmd: 'onAdapterAvailableChanged', adapterAvailable: adapterAvailable });
        });
        break;
      case 'disposeSDK':
        await oxyzen.disposeSDK();
        break;

      case 'startScan':
        await oxyzen.startScan(
          (adapterScanning: boolean) => {
            event.reply(oxyzResponse, { cmd: 'onScanning', adapterScanning: adapterScanning });
          },
          (devices: Array<OzDevice>) => {
            event.reply(oxyzResponse, {
              cmd: 'onFoundDevices',
              devices: devices.map((e: OzDevice) => ({
                id: e.id,
                name: e.name,
                isInPairingMode: e.isInPairingMode,
                batteryLevel: e.batteryLevel,
              })),
            });
          }
        );
        break;
      case 'stopScan':
        await oxyzen.stopScan();
        break;

      case 'connect':
        var deviceId = arg.deviceId;
        const deviceListener = {
          onError: (_: OzDevice, error: Error | null) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onError', error: error });
          },
          onDeviceInfoReady: (_: OzDevice, deviceInfo: Map<String, any>) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onDeviceInfoReady', deviceInfo: deviceInfo });
          },
          onConnectivityChanged: (_: OzDevice, connectivity: Number) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onConnectivityChanged', connectivity: connectivity });
          },
          onContactStateChanged: (_: OzDevice, contactState: Number) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onContactStateChanged', contactState: contactState });
          },
          onOrientationChanged: (_: OzDevice, orientation: Number) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onOrientationChanged', orientation: orientation });
          },
          onIMUData: (_: OzDevice, imu: Map<String, any>) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onIMUData', imu: imu });
          },
          onPPGData: (_: OzDevice, ppg: Map<String, any>) => {
            // ppgPrint(`onPPGData >>> ${JSON.stringify({seqNum: ppg.seqNum, reportRate: ppg.reportRate, algoData: ppg.algoData})}`);
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onPPGData', ppg: ppg });
          },
          onEEGData: (_: OzDevice, eeg: Map<String, any>) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onEEGData', eeg: eeg });
          },
          onBrainWave: (_: OzDevice, stats: Map<String, any>) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onBrainWave', stats: stats });
          },
          onAttention: (_: OzDevice, value: Number) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onAttention', attention: value });
          },
          onMeditation: (_: OzDevice, meditation: Number, calmness: Number, awareness: Number) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onMeditation', meditation: meditation, calmness: calmness, awareness: awareness });
          },
          onStress: (_: OzDevice, value: Number) => {
            event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onStress', stress: value });
          },
        };
        await oxyzen.connect(deviceId, deviceListener);
        break;
      case 'disconnect':
        await oxyzen.disconnect(arg.deviceId);
        break;
      case 'getConnectivity':
        var deviceId = arg.deviceId;
        var connectivity = oxyzen.getConnectivity(deviceId);
        event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onConnectivityChanged', connectivity: connectivity });
        break;
      case 'getContactState':
        var deviceId = arg.deviceId;
        var contactState = oxyzen.getContactState(deviceId);
        event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onContactStateChanged', contactState: contactState });
        break;
      case 'getOrientation':
        var deviceId = arg.deviceId;
        var orientation = oxyzen.getOrientation(deviceId);
        event.reply(oxyzResponse, { deviceId: deviceId, cmd: 'onOrientationChanged', orientation: orientation });
        break;
      case 'disconnectAll':
        await oxyzen.disconnectAll();
      default:
        break;
    }
  });

  if (app.isPackaged) {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  } else {
    // 🚧 Use ['ENV_NAME'] avoid vite:define plugin
    const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`

    win.loadURL(url)
    win.webContents.openDevTools()
  }

  // Test active push message to Renderer-process
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', process.versions)
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
  oxyzen.disposeSDK();
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
