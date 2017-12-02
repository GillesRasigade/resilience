///<reference path="./types/index.d.ts" />

import { EventEmitter } from "events";
import * as cluster from "cluster";

import * as uuid from "uuid/v4";
import * as hash from "object-hash";

import * as c from "./constants";

class Replica extends EventEmitter {
  /**
   * Unique process id
   */
  pid: number = process.pid;
  /**
   * Replica process type
   */
  type: string;
  /**
   * List of available replicas
   */
  replicas: Map<number, Replica> = new Map();

  constructor(type: string) {
    super();

    this.type = type;
    this.bind();

    return this.send({
      type: c.WORKER_START,
      times: [{
        event: c.MessageTimeEvents.EMITTED,
        date: new Date()
      }],
      idem: uuid(),
      payload: {
        pid: process.pid,
        type: this.type
      }
    });
  }

  log(message: string, args?: any) {
    console.log(`[REPLICA][${this.pid}] ${message}`, args);
  }

  message(message: Message): void {
    // this.log("Received message", message);
    switch (message.type) {
      case c.WORKER_REGISTER:
      case c.WORKER_START: {
        const replica = <Replica>message.payload;
        this.replicas.set(replica.pid, replica);
        break;
      }

      case c.WORKER_END: {
        const replica = <Replica>message.payload;
        this.replicas.delete(replica.pid);
        break;
      }
    }
  }

  bind(): Replica {
    process.on("SIGINT", this.exit.bind(this));
    process.on("message", this.message.bind(this));

    return this;
  }

  send(message: Message): Replica {
    process.send({
      ...message,
      pid: this.pid
    });

    return this;
  }

  exit(code: number = 0): Replica {
    this.log(`Stopping...`, process.pid);
    this.send({
      type: c.WORKER_END,
      times: [{
        event: MessageTimeEvents.EMITTED,
        date: new Date()
      }],
      idem: uuid(),
      payload: {
        pid: process.pid,
        type: this.type
      }
    });

    process.exit(code);

    return this;
  }
}

export default async function start(): Promise<Replica> {
  const type: string = process.env[c.WORKER_TYPE];

  console.log(`Replica ${type}@${process.pid} is running`);
  const replica = new Replica(type);

  return replica;
}