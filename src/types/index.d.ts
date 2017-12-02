declare interface Replica {
  pid: number;
  type: string;
  fork?: cluster.Worker
}

declare enum MessageTimeEvents {
  EMITTED = 0,
  PREPARED = 1,
  STORED = 2
}

/**
 * MessageTime is defining the interface of events
 * applying to a message from the emission to the store
 */
declare interface MessageTime {
  event: MessageTimeEvents,
  date: Date
}

/**
 * Message interface
 */
declare interface Message {
  type: string; // Message type
  times: MessageTime[]; // Times applying to the message
  idem: string; // Idempotency key
  criticity?: number; // Criticality of the message
  /**
   * Process id instegating the message
   */
  from?: number;
  /**
   * Process id of the recipient
   */
  to?: number;
  payload?: object;
}