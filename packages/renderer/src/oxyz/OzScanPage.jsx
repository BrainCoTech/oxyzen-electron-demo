import { Component } from 'react';
import OzActions from './OzActions'
import { Button } from '@mantine/core';
import { Scan, Bluetooth } from 'tabler-icons-react';

export function ScanDeviceList(props) {
  return props.devices.map((device) => <OzScanPage key={device.id} device={device} />);
}

export function ScanButton(props) {
  return <Button
    variant="light"
    rightIcon={<Scan size={20} />}
    radius="xl"
    size="md"
    styles={{
      root: { paddingRight: 14, height: 48 },
      rightIcon: { marginLeft: 5 },
    }}
    onClick={() => OzActions.toggleScan()}>{props.scanning ? 'stopScan' : 'startScan'}</Button>;
}

class OzScanPage extends Component {
  constructor() {
    super();
  }
  render() {
    var device = this.props.device;
    return (
      <div>
        <Button
          variant="light"
          leftIcon={<Bluetooth size={20} />}
          radius="xl"
          size="md"
          styles={{
            root: { paddingLeft: 14, height: 48 },
            leftIcon: { marginLeft: 5 },
          }}
          onClick={() => OzActions.connect(device)}>
          ID: {device.id}, name: {device.name}, 配对模式: {device.isInPairingMode ? 'Yes' : 'No'}, batteryLevel:
          {device.batteryLevel}
        </Button>
      </div>
    );
  }
}
