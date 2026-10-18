import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';

import type { ConnectivityService } from './types';

const online = (s: NetworkState): boolean => s.isInternetReachable ?? s.isConnected ?? false;

export const expoConnectivity: ConnectivityService = {
  isOnline: async () => online(await getNetworkStateAsync()),
  subscribe(cb) {
    const sub = addNetworkStateListener((state) => cb(online(state)));
    return () => sub.remove();
  },
};
