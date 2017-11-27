declare interface StringMap { [s: string]: string; }

declare interface IReplica {
  pid: number;
  type: string;
  fork?: cluster.Worker
}

declare interface Message {
  type: string;
  date: Date,
  idem: string,
  criticity?: number,
  payload?: object
}

