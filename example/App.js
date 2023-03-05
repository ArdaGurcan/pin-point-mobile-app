import {matrix, transpose, multiply, inv} from 'mathjs';

import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
  FlatList,
  TouchableHighlight,
  useColorScheme,
  Pressable,
  Image,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

const SECONDS_TO_SCAN_FOR = 3;
const SERVICE_UUIDS = [];
const ALLOW_DUPLICATES = false;

import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isSelected, setSelected] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [pos, setPos] = useState(new Array(3));
  const theme = useColorScheme();

  const updatePeripherals = (key, value) => {
    setPeripherals(new Map(peripherals.set(key, value)));
  };

  const triangulation = (r1, r2, r3) => {
    // Variables Kyle needs to give
    let rssi1 = r1 + 0.0;
    let rssi2 = r2 + 0.0;
    let rssi3 = r3 + 0.0;

    // Reference variables that we need to get beforehand
    let rssid0 = -44.0;
    let d0 = 0.3;

    // Coordinates of each bluetooth device (except user)
    let coord1 = [5.0, 4.2];
    let coord2 = [3.6, 3.4];
    let coord3 = [2.3, 1.5];

    // Find n variable
    let n1 = (rssid0 - rssi1) / 10.0;
    let n2 = (rssid0 - rssi2) / 10.0;
    let n3 = (rssid0 - rssi3) / 10.0;
    let n = (n1 + n2 + n3) / 3.0;

    // Solve distances
    let d1 = d0 * Math.pow(10.0, (rssi1 - rssid0) / (10.0 * n));

    let d2 = d0 * Math.pow(10.0, (rssi2 - rssid0) / (10.0 * n));

    let d3 = d0 * Math.pow(10.0, (rssi3 - rssid0) / (10.0 * n));

    // Matrix A
    let A = matrix([
      [2.0 * (coord1[0] - coord3[0]), 2.0 * (coord2[0] - coord3[0])],
      [2.0 * (coord1[1] - coord3[1]), 2.0 * (coord2[1] - coord3[1])],
    ]);

    // Matrix A transposed
    let AT = transpose(A);

    // Matrix b
    let b = matrix([
      [
        Math.pow(2, coord1[0]) -
          Math.pow(2, coord3[0]) +
          Math.pow(2, coord1[1]) -
          Math.pow(2, coord3[1]) +
          Math.pow(2, d3) -
          Math.pow(2, d1),
      ],
      [
        Math.pow(2, coord2[0]) -
          Math.pow(2, coord3[0]) +
          Math.pow(2, coord2[1]) -
          Math.pow(2, coord3[1]) +
          Math.pow(2, d2) -
          Math.pow(2, d1),
      ],
    ]);

    // Inverse of (AT * A)
    let i = multiply(AT, A);
    let iinverse = inv(i);
    let j = multiply(iinverse, AT);
    let x = multiply(j, b);

    return x.toArray().join(', ');
  };

  const startScan = () => {
    if (!isScanning) {
      try {
        setIsScanning(true);
        BleManager.scan(SERVICE_UUIDS, SECONDS_TO_SCAN_FOR, ALLOW_DUPLICATES);
      } catch (error) {}
    }
  };

  const handleStopScan = () => {
    setIsScanning(false);
  };

  const handleDisconnectedPeripheral = data => {
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      updatePeripherals(peripheral.id, peripheral);
    }
  };

  const handleUpdateValueForCharacteristic = data => {
    // console.log(
    //   'Received data from ' +
    //     data.peripheral +
    //     ' characteristic ' +
    //     data.characteristic,
    //   data.value,
    // );
  };

  const handleDiscoverPeripheral = peripheral => {
    // console.log('Got ble peripheral', peripheral);
    if (peripheral.name) {
      // peripheral.name = 'NO NAME';
      updatePeripherals(peripheral.id, peripheral);

      if (Array.from(peripherals.values()).length >= 3) {
        setPos(Array.from(peripherals.values()).slice(0, 3));
      }
    }
  };

  const togglePeripheralConnection = async peripheral => {
    if (peripheral && peripheral.connected) {
      BleManager.disconnect(peripheral.id);
    } else {
      connectPeripheral(peripheral);
    }
  };

  const connectPeripheral = async peripheral => {
    try {
      if (peripheral) {
        markPeripheral({connecting: true});
        await BleManager.connect(peripheral.id);
        markPeripheral({connecting: false, connected: true});
      }
    } catch (error) {
      // console.log('Connection error', error);
    }
    function markPeripheral(props) {
      updatePeripherals(peripheral.id, {...peripheral, ...props});
    }
  };

  useEffect(() => {
    BleManager.start({showAlert: false});
    const listeners = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      ),
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      ),
    ];

    handleAndroidPermissionCheck();

    return () => {
      for (const listener of listeners) {
        listener.remove();
      }
    };
  }, []);

  const handleAndroidPermissionCheck = () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then(result => {
        if (result) {
        } else {
          PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ).then(result => {
            if (result) {
            } else {
            }
          });
        }
      });
    }
  };

  const renderItem = ({item}) => {
    const backgroundColor = '#60B95B';
    
    return (
      <TouchableHighlight
        underlayColor="rgba(0,0,0,0)"
        onPress={() => setSelected(!isSelected)}>
        <View style={[styles.row, {backgroundColor}]}>
          <Text style={[styles.peripheralName, {}]}>{item.name}</Text>
          {isSelected && <View>
            <Text style={styles.rssi}>RSSI: {item.rssi}</Text>
            <Text style={styles.peripheralId}>UUID: {item.id}</Text>
          </View>}
        </View>
      </TouchableHighlight>
    );
  };

  return (
    <>
      <StatusBar />
      <SafeAreaView style={styles.body}>
        <View  style={styles.logoContainer}>
        <Image source={require("./logo_transparent.png")} style={styles.logo} />

        </View>

        <Pressable style={styles.scanButton} onPress={startScan}>
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Searching...' : 'Search for Beacons'}
          </Text>
        </Pressable>

        {Array.from(peripherals.values()).length < 3 && (
          <View style={styles.row}>
            <Text style={styles.noPeripherals}>
              At least 3 beacons required for trilateration
            </Text>
          </View>
        )}
        <FlatList
          data={Array.from(peripherals.values())}
          contentContainerStyle={{rowGap: 12}}
          renderItem={renderItem}
          keyExtractor={item => item.id}
        />
        {pos[0] != null && (
          <View style={styles.accBox}>
            <Text style={styles.accText}>
              Trilaterated User Position:{'\n'} ({triangulation(pos[0].rssi, pos[1].rssi, pos[2].rssi)})
            </Text>
          </View>
        )}
      </SafeAreaView>
    </>
  );
};

const boxShadow = {
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 4,
  },
  shadowOpacity: 0.5,
  shadowRadius: 3.84,
  elevation: 5,
};

const styles = StyleSheet.create({
  logo: {

    height: 150,
    width: 150,
    // ...boxShadow
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  engine: {
    position: 'absolute',
    right: 10,
    bottom: 0,
    color: Colors.black,
  },
  scanButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#BAE040',
    margin: 10,
    borderRadius: 12,
    ...boxShadow,
  },
  scanButtonText: {
    color: '#000',
    fontSize: 20,
    letterSpacing: 0.25,
    fontWeight:600,
    // ...boxShadow,
  },
  body: {
    backgroundColor: '#006B6B',
    flex: 1,

  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
  peripheralName: {
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
  },
  rssi: {
    fontSize: 12,
    textAlign: 'center',
    padding: 2,
  },
  peripheralId: {
    fontSize: 12,
    textAlign: 'center',
    padding: 2,
    paddingBottom: 20,
  },
  row: {
    marginLeft: 10,
    marginRight: 10,
    borderRadius: 20,
    ...boxShadow,
  },
  accBox: {
    margin: 10,
    padding: 20,
    backgroundColor: '#5581D1',
    borderRadius: 20,
    ...boxShadow,
  },
  accText: {
    color: '#000',
    textAlign: 'center',
    fontSize: 20,

  },
  noPeripherals: {
    margin: 10,
    textAlign: 'center',
    color: 'white',
  },
});

export default App;
