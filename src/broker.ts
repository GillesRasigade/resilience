///<reference path="./types/index.d.ts" />

import * as os from "os";
import { EventEmitter } from "events";
import * as cluster from "cluster";

import * as _ from "lodash";
import * as uuid from "uuid/v4";
import * as hash from "object-hash";

import * as c from "./constants";
import { setInterval } from "timers";

class Broker extends EventEmitter {
  n: number;
  keepAlive: boolean;
  replicas: Map<number, Replica> = new Map();

  constructor(n: number = 1, keepAlive: boolean = true) {
    super();

    this.n = n;
    this.keepAlive = keepAlive;

    for (let i = 0; i < this.n; i++) {
      this.fork();
    }
  }

  log(message: string, args: object = {}) {
    console.log(`[BROKER] ${message}`, args);
  }

  message(worker: cluster.Worker, message: Message): void {
    // console.log(`Received message from ${worker.process.pid}`, message);

    switch (message.type) {
      case c.REPLY: {
        this.emit(message.idem, message);
        return;
      }
    }

    return this.broadcast(message);
  }

  send(message: Message, worker: cluster.Worker = undefined) {
    if (!worker) {
      /**
       * Random determination of a worker to receive this message
       */
      const items = Array.from(this.replicas);
      [, { fork: worker }] = items[Math.floor(Math.random() * items.length)];
    }

    worker.send(message);
  }

  /**
   * Broadcast a message to all replicas based on conditions
   *
   * @param message The message to broadcast
   */
  broadcast(message: Message) {
    for (const [pid, { fork }] of this.replicas) {
      if (message.from && pid === message.from) {
        // Skip the instegating replica from broadcast
        continue;
      }

      if (message.to && pid !== message.to) {
        // Skip not recipient replicas
        continue;
      }

      this.send(message, fork);
    }
  }

  /**
   * This function is called each time a worker is exiting
   *
   * @param worker The exited worker
   * @param code The exit code
   * @param signal The exit signal
   */
  workerExit(worker: cluster.Worker, code: number, signal: string): void {
    const pid: number = worker.process.pid;

    this.log("Worker died", { pid: `${pid}` });

    const replica = this.replicas.get(pid);
    this.replicas.delete(pid);

    if (!this.keepAlive === true) {
      this.log("keepAlive not activated");
      return;
    }

    if (code === 0) {
      this.log("Worker stopped gracefully");
      return;
    }

    this.fork(replica.type);
  }

  /**
   * Fork a new process
   * @param type Process type identifier
   * @returns {Broker}
   */
  fork(type: string = "worker"): Broker {
    const fork = cluster.fork({
      [c.WORKER_TYPE]: type
    });

    const replica = {
      pid: fork.process.pid,
      type,
      fork
    };

    fork.on("message", this.message.bind(this, fork));
    fork.on("exit", this.workerExit.bind(this, fork));

    for (const [pid, repl] of this.replicas) {
      this.send({
        type: c.WORKER_REGISTER,
        times: [{
          event: c.MessageTimeEvents.EMITTED,
          date: new Date()
        }],
        idem: uuid(),
        payload: _.omit(repl, "fork")
      }, fork);
    }

    /**
     * The following warning is due to a miss loading of cluster namespace
     */
    this.replicas.set(replica.pid, replica);

    return this;
  }

  /**
   * Request workflow applied to the replicas
   * @param request
   */
  request(request: Message): Broker {
    this.send(request);

    return;
  }
}


/** TMP >>> */

export async function store(broker: Broker) {
  const handlerFactory = (request: Message) => {
    const tic = new Date();
    const validation: {[s: string]: number} = {};
    const messages: Map<string, Message> = new Map();
    let count = 0;
    let validDigest: string;

    /**
     * Reply handler
     * @todo Identify replicas in failure
     * @todo Force resync of replicas in failure
     *
     * @param message
     */
    const handler = (message: Message) => {
      // @warning possible performances issues
      const digest = hash(message.payload);
      count++;

      messages.set(digest, message);

      validation[digest] = (validation[digest] || 0) + 1;
      console.log("   ", message.payload.id, message.pid);

      if (validation[digest] == 2) {
        validDigest = digest;
        const tac = new Date();

        console.log(196, message.payload.id, `${tac.getTime() - tic.getTime()} ms`);
      }

      if (count === broker.n) {
        // Unregister the handler
        broker.removeListener(request.idem, handler);

        for (const [digest, message] of messages) {
          if (digest !== validDigest) {
            console.log(196, digest, message.payload);
            broker.broadcast({
              type: c.FAILING,
              times: [{
                event: c.MessageTimeEvents.EMITTED,
                date: new Date()
              }],
              idem: uuid(),
              to: message.pid
            });
          }
        }
      }

    };

    // Cleanup the listener if not all processes answers
    // @warning possible memory intensive
    setTimeout(() => {
      broker.removeListener(request.idem, handler);
    }, 1000);

    return handler;
  };

  const sendRequest = () => {
    const data = {
      v: `${Math.floor(Math.random() * 10)}`,
      data: "This is my data"
    };

    const request: Message = {
      type: c.MESSAGE,
      times: [{
        event: c.MessageTimeEvents.EMITTED,
        date: new Date()
      }],
      idem: uuid(),
      payload: data
    };

    broker.on(request.idem, handlerFactory(request));
    broker.broadcast(request);
  };

  setInterval(sendRequest, 1000);
  // setInterval(sendRequest, 1001);
  // broker.request(request);

  // setTimeout(() => {
  //   broker.on(request2.idem, handlerFactory());
  //   broker.request(request2);
  // }, 1000);
}

/** <<< TMP */

export default async function start(): Promise<Broker> {
  console.log(`Broker ${process.pid} is running`);

  const errors = 1;
  const nReplicas = 3 * errors + 1;

  const broker = new Broker(nReplicas);

  setTimeout(() => {
    store(broker);
  }, 3000);

  return broker;
}
