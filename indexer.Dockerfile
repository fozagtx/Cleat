FROM golang:1.25.1-bookworm AS builder

ARG INDEXER_REF=65a3b809eda8930e185d443c82dfcbc35cb14c99
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone https://github.com/flare-foundation/flare-system-c-chain-indexer.git . \
    && git checkout "${INDEXER_REF}"
RUN go mod download \
    && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -trimpath -o /out/indexer ./cmd/indexer

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /out/indexer /app/indexer
COPY config/indexer.coston2.toml /app/config.toml
EXPOSE 8080
CMD ["/app/indexer", "--config", "/app/config.toml"]
