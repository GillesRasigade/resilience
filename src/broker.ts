///<reference path="./types/index.d.ts" />

import * as os from "os";
import { EventEmitter } from "events";
import * as cluster from "cluster";

import * as _ from "lodash";
import * as uuid from "uuid/v4";

import * as c from "./constants";

class Broker extends EventEmitter {
  n: number;
  keepAlive: boolean;
  replicas: Map<number, IReplica> = new Map();

  constructor(n: number = 1, keepAlive: boolean = true) {
    super();

    this.n = n;
    this.keepAlive = keepAlive;

    for (let i = 0; i < this.n; i++) {
      this.fork();
    }
  }

  log(message: string, args: StringMap = {}) {
    console.log(`[BROKER] ${message}`, args);
  }

  message(worker: cluster.Worker, message: Message): void {
    console.log(`Received message from ${worker.process.pid}`, message);

    switch (message.type) {
      case c.WORKER_END:
      case c.WORKER_START: {
        this.broadcast(message);
        break;
      }
    }
  }

  send(worker: cluster.Worker, message: Message) {
    worker.send(message);
  }

  broadcast(message: Message) {
    for (const [pid, { fork }] of this.replicas) {
      this.send(fork, message);
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
    console.log(79, this.replicas.size);
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
      this.send(fork, {
        type: c.WORKER_REGISTER,
        date: new Date(),
        idem: uuid(),
        payload: _.omit(repl, "fork")
      });
    }

    /**
     * The following warning is due to a miss loading of cluster namespace
     */
    this.replicas.set(replica.pid, replica);

    return this;
  }
}

export default async function start(): Promise<Broker> {
  console.log(`Broker ${process.pid} is running`);

  const CPUS = os.cpus();
  const nReplicas = CPUS.length - 1;

  const broker = new Broker(nReplicas);

  return broker;
}
