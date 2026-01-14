
export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
  sources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}
