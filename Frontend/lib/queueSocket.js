import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

export function connectQueueSocket() {
  return io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
}
