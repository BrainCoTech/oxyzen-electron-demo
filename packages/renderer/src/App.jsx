import { Component } from 'react'
import { observer } from 'mobx-react';
import { ScanButton, ScanDeviceList } from './oxyz/OzScanPage';
import { OzDeviceList } from './oxyz/OzDeviceWidget';
import OzActions from './oxyz/OzActions'
import { Button } from '@mantine/core';

const App = observer(
  class App extends Component {
    constructor() {
      super();
    }

    render() {
      const oxyz = this.props.oxyzObservable;
      if (!oxyz.adapterAvailable) {
        return (<div>
          <p />
          蓝牙连接不可用
        </div>);
      }
      var devicesList =
        oxyz.devices.length > 0 ? (
          <div>
            <p />
            连接中/已连接设备列表
            <OzDeviceList devices={oxyz.devices} />
          </div>
        ) : null;
      return (
        <div>
          <Button
            variant="light"
            radius="xl"
            size="md"
            onClick={() => OzActions.disconnectAll()}>disconnectAll</Button>
          <p />
          <ScanButton scanning={oxyz.adapterScanning} />
          <p />
          扫描到的设备列表
          <ScanDeviceList devices={oxyz.scannedDevices} />
          {devicesList}
        </div>
      );
    }
  }
);

export default App