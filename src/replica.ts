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
   * Does the replica process the requests
   */
  processing: boolean = false;
  /**
   * Does this replica is failing
   */
  failing: boolean = false;
  /**
   * List of available replicas
   */
  replicas: Map<number, Replica> = new Map();
  /**
   * Ordered messages digest
   */
  journal: Map<string, number> = new Map();
  nextJournalEntryId: number = 0;
  /**
   * Map of messages
   */
  messages: Map<string, Message> = new Map();

  constructor(type: string) {
    super();

    this.type = type;
    this.bind();

    // For testing purpose
    this.failing = Math.random() < 0.25;

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

  process() {
    if (this.processing === true) {
      return;
    }

    for (const [digest] of this.journal) {
      try {
        const message = this.messages.get(digest);
        // console.log(62, digest, message);

        this.messages.delete(digest);
        this.journal.delete(digest);
        // console.log(68, "After cleanup", this.messages.size, this.journal.size);
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Store the request with valid order
   * @param message
   */
  storeMessage(message: Message) {
    const digest = hash(message);

    let messageId = this.journal.get(digest);

    if (messageId === undefined) {
      messageId = this.nextJournalEntryId;
      this.nextJournalEntryId++;

      // For testing purpose
      if (this.failing) {
        messageId++;
      }

      this.journal.set(digest, messageId);
      this.messages.set(digest, message);

    }

    this.send({
      type: c.REPLY,
      idem: message.idem,
      times: [
        ...message.times,
        {
          event: c.MessageTimeEvents.STORED,
          date: new Date()
        }
      ],
      payload: {
        id: messageId
      }
    });

    this.emit("process");
  }

  onFailing(message: Message): void {
    this.log("Failing...", message);

    this.failing = true;

  }

  onMessage(message: Message): void {
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

      case c.MESSAGE: {
        this.storeMessage(message);
        break;
      }

      case c.FAILING: {
        this.onFailing(message);
        break;
      }
    }
  }

  bind(): Replica {
    process.on("SIGINT", this.exit.bind(this));
    process.on("message", this.onMessage.bind(this));

    this.on("process", this.process.bind(this));

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
        event: c.MessageTimeEvents.EMITTED,
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