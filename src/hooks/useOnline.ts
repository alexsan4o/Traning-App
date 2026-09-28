import { useNetInfo } from '@react-native-community/netinfo';

import { useAppStore } from '../store/useAppStore';

export interface OnlineStatus {
  /** Есть сеть и пользователь не запретил онлайн-функции. */
  online: boolean;
  /** Есть ли подключение к сети вообще. */
  connected: boolean;
  /** Пользователь разрешил онлайн-функции в настройках. */
  allowed: boolean;
}

export function useOnline(): OnlineStatus {
  const net = useNetInfo();
  const allowed = useAppStore((s) => s.settings.onlineEnabled);
  // До первого ответа NetInfo значение null — считаем, что сеть есть, запросы сами обработают ошибку.
  const connected = net.isConnected !== false && net.isInternetReachable !== false;
  return { online: allowed && connected, connected, allowed };
}
