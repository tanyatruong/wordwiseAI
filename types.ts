
export interface Language {
  code: string;
  name: string;
  flag: string;
  instruction: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  personality: string;
  color: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string;
  timestamp: number;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
