import { observable, runInAction } from 'mobx';
import { CONNECTIVITY } from './enum'

const oxyzRequest = 'oxyz-request';
const oxyzResponse = 'oxyz-response';

const _oxyzMap = new Map();

class OzActions {
  static _initialized = false;
  static oxyzObservable = observable({
    adapterAvailable: false,
    adapterScanning: false,
    scannedDevices: [],
    devices: [],
  });

  static initSDK() {
    window.ipcRenderer.on(oxyzResponse, (_, arg) => {
      switch (arg.cmd) {
        case 'onAdapterAvailableChanged':
          if (OzActions.oxyzObservable.adapterAvailable == arg.adapterAvailable) return;
          console.log(arg);
          runInAction(() => {
            OzActions.oxyzObservable.adapterAvailable = arg.adapterAvailable;
          });
          if (!this._initialized && arg.adapterAvailable) {
            this._initialized = true;
            this._autoConnect();
          }
          break;
        case 'onScanning':
          console.log(arg);
          runInAction(() => {
            OzActions.oxyzObservable.adapterScanning = arg.adapterScanning;
          });
          break;
        case 'onFoundDevices':
          console.log(arg);
          runInAction(() => {
            OzActions.oxyzObservable.scannedDevices = arg.devices;
          });
          break;
        case 'onError':
          console.log('[onError] deviceId', arg.deviceId, 'error', arg.error);
          break;

        case 'onDeviceInfoReady':
        case 'onConnectivityChanged':
        case 'onContactStateChanged':
        case 'onOrientationChanged':
          console.log(arg);
          this.onDeviceEvent(arg);
          break;

        case 'onBrainWave':
        case 'onEEGData':
        case 'onIMUData':
        case 'onPPGData':
        case 'onMeditation':
        case 'onAwareness':
        case 'onStress':
          this.onDeviceEvent(arg);
          break;
        default:
          break;
      }
    });

    this._sendCmd('initSDK');
  }

  static disposeSDK() {
    this._initialized = false;
    this._sendCmd('disposeSDK');
  }

  static _sendCmd(cmd, params) {
    if (!this._initialized && cmd != 'initSDK') {
      console.log(cmd, 'while OxyZenSDK is not initialized');
      return;
    }
    console.log('[OzActions]', cmd);
    window.ipcRenderer.send(oxyzRequest, { cmd: cmd, ...params });
  }

  static startScan() {
    runInAction(() => {
      OzActions.oxyzObservable.scannedDevices = [];
    });
    this._sendCmd('startScan');
  }

  static stopScan() {
    this._sendCmd('stopScan');
  }

  static toggleScan() {
    if (!OzActions.oxyzObservable.adapterScanning) {
      this.startScan();
    } else {
      this.stopScan();
    }
  }

  static connect(device) {
    if (!device) return;
    var deviceId = device.id;
    if (!deviceId) return;

    // runInAction(() => {
    //   OzActions.oxyzObservable.scannedDevices = [];
    // });
    _oxyzMap.set(deviceId, { id: deviceId, name: device.name });
    this._sendCmd('connect', { deviceId: deviceId });
    this._notifyUpdateDevices();
  }

  static disconnect(device) {
    if (!device) return;
    var deviceId = device.id;
    if (!deviceId) return;

    _oxyzMap.delete(deviceId);
    this._sendCmd('disconnect', { deviceId: deviceId });
    this._notifyUpdateDevices();
    this._updateDeviceRecords();
  }

  static disconnectAll() {
    _oxyzMap.clear();
    _oxyzMap.forEach((device) => {
      device.store = null;
    });
    this._sendCmd('disconnectAll');
    this._notifyUpdateDevices();
    this._updateDeviceRecords();
  }

  static _notifyUpdateDevices() {
    const devices = Array.from(_oxyzMap.values());
    // console.log('_notifyUpdateDevices', devices);
    // refresh ui
    runInAction(() => {
      OzActions.oxyzObservable.devices = devices;
    });
  }

  static onDeviceEvent(arg) {
    var deviceId = arg.deviceId;
    if (!deviceId) return;
    var device = _oxyzMap.get(deviceId);
    if (!device) return;

    switch (arg.cmd) {
      case 'onDeviceInfoReady':
        device.deviceInfo = arg.deviceInfo;
        this._notifyUpdateDevices();
        break;
      case 'onConnectivityChanged':
        console.log('onConnectivityChanged', arg.connectivity);
        device.connectivity = arg.connectivity;
        if (device.connectivity == CONNECTIVITY['connected']) {
          if (!device.store) {
            device.store = true;
            this._updateDeviceRecords();
          }
        } else {
          //reset other state when device is not connected
          device.contactState = 0;
          device.orientation = 0;
          device.meditation = 0;
          device.awareness = 0;
          device.stress = 0;
          device.stats = null;
        }
        this._notifyUpdateDevices();
        break;
      case 'onContactStateChanged':
        device.contactState = arg.contactState;
        this._notifyUpdateDevices();

        break;
      case 'onOrientationChanged':
        device.orientation = arg.orientation;
        this._notifyUpdateDevices();
        break;
      case 'onBrainWave':
        device.stats = arg.stats;
        this._notifyUpdateDevices();
        break;
      case 'onMeditation':
        device.meditation = arg.meditation.toFixed(1);
        this._notifyUpdateDevices();
        break;
      case 'onAwareness':
        device.awareness = arg.awareness.toFixed(1);
        this._notifyUpdateDevices();
        break;
      case 'onStress':
        device.stress = arg.stress.toFixed(1);
        this._notifyUpdateDevices();
        break;
      case 'onEEGData':
        device.eeg = arg.eeg;
        break;
      case 'onIMUData':
        device.imu = arg.imu;
        break;
      case 'onPPGData':
        device.ppg = arg.ppg;
        break;
      default:
        break;
    }
  }

  // [TBD] move to main progress
  // static deviceStore = new Store();
  static _updateDeviceRecords() {
    const records = Array.from(_oxyzMap.values())
      .filter((e) => e.store == true)
      .map((e) => {
        return { id: e.id, name: e.name };
      });
    console.log('_updateDeviceRecords', records);
    // deviceStore.set('oxyzRecords', records);
  }

  static _autoConnect() {
    console.log('loadDeviceRecords');
    // var deviceId = '58:94:b2:00:02:39';
    // deviceId     = '58:94:b2:00:a5:7f';
    // this._sendCmd('connect', { deviceId: deviceId });
    // const devices = deviceStore.get('oxyzRecords');
    // if (Array.isArray(devices) && devices.length > 0) {
    //   console.log('autoConnect');
    //   devices.forEach((device) => {
    //     if (device.id && device.name) {
    //       device.store = true;
    //       this.connect(device);
    //     }
    //   });
    //   this._notifyUpdateDevices();
    // }
  }
}

export default OzActions;
