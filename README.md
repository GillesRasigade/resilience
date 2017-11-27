# `resilience`

The purpose of this project is to fix objects definitions, functions and
patterns which a required to have fully resilient architecture.

<!-- TOC depthFrom:2 -->

- [State machine](#state-machine)
- [Definitions](#definitions)
  - [Scenario](#scenario)
  - [Steps](#steps)
- [Messages](#messages)
  - [Request](#request)
  - [Pre-prepare](#pre-prepare)
  - [Prepare](#prepare)
  - [Commit](#commit)
  - [Reply](#reply)
  - [Commander (master)](#commander-master)
  - [Generals (replicas)](#generals-replicas)

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

## Messages

### Request

The `request` has the following required properties:

- `type`: `<string>`
- `date`: `<date>`
- `idemkey`: `<string>`
- `criticity`: `<number>`
- `payload`: `<object>`

### Pre-prepare

In an Event Sourcing system, the *deterministic* requirement is fullfilled with
order guarantee events. The number attached to an event is given by:
`current state number + 1`.

For example, the very first event number is starting from `0`. Its reduction is
leading to state with number `0`. The next event will then have a number of
`1` for this state.

### Prepare

### Commit

### Reply

### Commander (master)

The general is publishing the **n** `requests` and is waiting for the responses.

The messages are identifying the commander and the generals.

### Generals (replicas)

Each general is applying

# References

[1] M. Castro, B. Liskov, *Practical Byzantine Fault Tolerance*, 1999 ([pdf](http://pmg.csail.mit.edu/papers/osdi99.pdf))
