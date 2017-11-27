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
  replicas: Map<number, IReplica> = new Map();
  /**
   * Events @todo must be implemented
   */
  events: Map<string, Set<object>> = new Map();
  /**
   * Replica current state
   */
  state: Map<string, Item> = new Map();
  /**
   * List of all available logs
   */
  logs: Set<Log> = new Set();
  /**
   * Already accepted preprepared
   */
  preprepared: Map<string, {
    d: string;
    m: object;
  }> = new Map();
  /**
   * Counts of prepares responses
   */
  prepares: Map<string, number> = new Map();

  constructor(type: string) {
    super();

    this.type = type;
    this.bind();

    return this.send({
      type: c.WORKER_START,
      date: new Date(),
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

  getPreparedId(v: string, n: number): string {
    return hash({ v, n });
  }

  getItem(v: string): Item {
    return this.state.get(v);
  }

  getN(v: string): number {
    const item = this.getItem(v);
    if (!item) {
      return 0;
    }

    const events = this.events.get(item.v) || new Set();

    return item ? item.n + events.size + 1 : 0;
  }

  addPrepare(v: string, n: number): number {
    const prepareId = this.getPreparedId(v, n);
    const current = this.prepares.get(prepareId) || 0;
    const count = current + 1;

    this.prepares.set(prepareId, count);

    return count;
  }

  /**
   * Send the request to the other replicas
   *
   * The request must be inserted into a fully ordered array
   *
   * @param message
   */
  request(message: Message): void {
    this.log("New request", message);
    const { payload: request } = message;
    const digest = hash(request);
    const v = request.v;

    const n = this.getN(v);

    this.send({
      type: c.PREPREPARE,
      date: message.date,
      idem: message.idem,
      // from: this.pid,
      payload: {
        v, // Object id
        n, // Object version number
        d: digest, // Request digest
        m: request // Request to be decouplage from the total order request
      }
    });
  }

  prePrepare(message: Message): void {
    this.log("Pre-Prepare", message);
    const { payload } = message;
    const item = this.getItem(payload.v);
    const digest = hash(payload.m);

    if (digest !== payload.d) {
      this.log("#prePrepare Request digest do not match");
      return;
    }

    /**
     * Retrieves an already preprepared message on the specified item with
     * the given item version number
     */
    const prepreparedId = this.getPreparedId(payload.v, payload.n);

    const currentPreprepared = this.preprepared.get(prepreparedId);

    if (currentPreprepared !== undefined && currentPreprepared.d !== digest) {
      this.log("#prePrepare Preprepared request already pending on item");
      return;
    }

    const log = {
      type: message.type,
      v: payload.v,
      n: payload.n,
      d: payload.d
    };

    if (this.logs.has(log)) {
      // Does nothing, already done
      return;
    }

    this.logs.add(log);
    this.preprepared.set(prepreparedId, {
      d: digest,
      m: payload.m
    });

    this.send({
      type: c.PREPARE,
      date: message.date,
      idem: message.idem,
      // from: this.pid,
      payload: {
        v: payload.v,
        n: payload.n,
        d: payload.d,
        i: this.pid
      }
    });
  }

  prepare(message: Message): void {
    this.log("Prepare", message);
    const { payload } = message;
    const log = {
      type: message.type,
      v: payload.v,
      n: payload.n,
      d: payload.d
    };

    /**
     * @todo Add a timeout here
     */

    const count = this.addPrepare(payload.v, payload.n);
    const acceptance = 2 * ( this.replicas.size - 1 ) / 3 + 1;
    if (count >= acceptance) {
      this.send({
        type: c.COMMIT,
        date: message.date,
        idem: message.idem,
        from: this.pid,
        payload: {
          v: payload.v,
          n: payload.n,
          d: payload.d,
          i: this.pid
        }
      });
    }
  }

  commit(message: Message): void {
    this.log("Commit", message);
    const { payload } = message;

    const prepreparedId = this.getPreparedId(payload.v, payload.n);

    const { m: request } = this.preprepared.get(prepreparedId);
    const state = {
      ...request,
      n: payload.n
    };
    this.state.set(payload.v, state);

    this.send({
      type: c.REPLY,
      date: message.date,
      idem: message.idem,
      from: this.pid,
      payload: request
    });

    this.preprepared.delete(prepreparedId);
  }

  message(message: Message): void {
    // this.log("Received message", message);
    switch (message.type) {
      case c.WORKER_REGISTER:
      case c.WORKER_START: {
        const replica = <IReplica>message.payload;
        this.replicas.set(replica.pid, replica);
        break;
      }

      case c.WORKER_END: {
        const replica = <IReplica>message.payload;
        this.replicas.delete(replica.pid);
        break;
      }

      case c.REQUEST: {
        this.request(message);
        break;
      }

      case c.PREPREPARE: {
        this.prePrepare(message);
        break;
      }

      case c.PREPARE: {
        this.prepare(message);
        break;
      }

      case c.COMMIT: {
        this.commit(message);
        break;
      }

      case c.QUERY: {
        const item = this.state.get(message.payload.v);
        const reply = {
          type: c.REPLY,
          date: message.date,
          idem: message.idem,
          payload: item
        };
        this.send(reply);
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
      date: new Date(),
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