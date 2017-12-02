declare interface StringMap { [s: string]: string; }

declare interface IReplica {
  pid: number;
  type: string;
  fork?: cluster.Worker
}

declare interface Message {
  /**
   * Unique message type
   */
  type: string;
  date: Date;
  idem: string;
  criticity?: number;
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

declare interface Log {
  /**
   * Log type
   */
  type: string;
  /**
   * Item id
   */
  v: string;
  /**
   * Item version number
   */
  n: number;
  /**
   * Digest of the request
   */
  d: string;
  /**
   * Item to apply the changes
   */
  m?: Item
}

declare interface Item {
  v: string;
  n: number;
}
