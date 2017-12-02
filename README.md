# `resilience`

The purpose of this project is to fix objects definitions, functions and
patterns which a required to have fully resilient architecture.

<!-- TOC depthFrom:2 -->

- [State machine](#state-machine)
- [Definitions](#definitions)
  - [Scenario](#scenario)
  - [Steps](#steps)
- [Reconciliation](#reconciliation)

<!-- /TOC -->

## State machine

Each node of the system is acting as a state machine.

The state machine is built in our application with Event-Sourcing and events
reduction with pure functions.

## Definitions

You will find below definitions for this project.

### Scenario

A client is sending a `request` to the system. This command is modifying several
objects and a response is given.

### Steps

The `request` is published several times to a broker depending on its
criticality level. The number of messages is computed with the following
formula from the Byzantine Generals problem:

```math #byzantine
n = 3 x errors + 1
```

# Protocol

The main philosophy behind this protocol is to respect local processing. An
event is stored in a replica with the event **reception** timestamp. By
consequence, each event will have different persitence timestamps but their
reconciliation order must be guaranteed.

Once events are stored, the overall events order is guaranteed by the BFT
protocol. If the broker is faulty,

- The request is broadcast to all replicas
- Each replica is storing the request in the events referential with a
  pending validation flag
- It broadcast a message informing the reception and persistence of a request
  with a valid digest (no big payload communication)
- The replica is receiving the message reception and validates the digest
  with the locally stored event
- Once `2f+1` reception messages are received, the event is inserted into
  the events referential

A top level replica controller is in charge to

## Reconciliation

# References

[1] M. Castro, B. Liskov, *Practical Byzantine Fault Tolerance*, 1999 ([pdf](http://pmg.csail.mit.edu/papers/osdi99.pdf))
