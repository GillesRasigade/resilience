export enum MessageTimeEvents {
  EMITTED = 0,
  PREPARED = 1,
  STORED = 2,
  PROCESSED = 3,
  REPLY = 4
}

export const WORKER_TYPE: string = "WORKER_TYPE";
export const WORKER_START: string = "WORKER_START";
export const WORKER_END: string = "WORKER_END";

export const WORKER_REGISTER: string = "WORKER_REGISTER";

export const QUERY: string = "QUERY";

export const MESSAGE: string = "MESSAGE";
export const FAILING: string = "FAILING";

export const REQUEST: string = "REQUEST";
export const PREPREPARE: string = "PREPREPARE";
export const PREPARE: string = "PREPARE";
export const COMMIT: string = "COMMIT";
export const REPLY: string = "REPLY";
