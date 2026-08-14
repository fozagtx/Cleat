# Cleat TEE

Cleat's only confidential extension implementation is Go. The production image embeds tee-node and the extension in one static distroless binary.

## Layout

```
cmd/
├── main.go             Standalone extension server (local dev)
├── docker/main.go      Combined tee-node + extension — the image entry point
└── start-tee/main.go   Host-process runner backing `start-services.sh --local`
internal/
├── config/config.go    ★ Version, OPType and OPCommand constants
├── extension/
│   ├── extension.go    Cleat command routing and result encoding
│   ├── rehydration.go  Authoritative Coston2 pledge replay
│   └── utils.go        Action and result envelopes
└── machine/
    └── machine.go      Confidential pledge and financing state machine
pkg/
├── server/server.go    Extension server
└── types/types.go      Observable state types
```

## Develop

```bash
cd go && go build ./... && go test ./...
```

Or from the repo root:

```bash
./scripts/test-unit.sh
```

Run the extension alone (no tee-node, no proxy) on a port of your choosing:

```bash
EXTENSION_PORT=8080 go run ./cmd
```

The extension starts fail-closed. Production sets `REHYDRATION_ENABLED=true`, `PLEDGE_REGISTRY_ADDRESS`, and `REHYDRATION_FROM_BLOCK`; only a successful Coston2 event replay marks the store authoritative.
