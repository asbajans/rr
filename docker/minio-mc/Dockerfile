# MinIO Client (mc) — kaynaktan derlenir.
# Neden: docker/minio/Dockerfile başındaki nota bak (quay.io 401 veriyor).
# Kaynak: https://github.com/minio/mc (AGPLv3) — resmi yöntem:
#   go install github.com/minio/mc@latest
#
# Kullanım: docker build -f docker/minio-mc/Dockerfile -t ghcr.io/asbajans/rahatio/minio-mc:latest .

FROM golang:1.24-bookworm AS build
ARG MC_VERSION=latest
ENV CGO_ENABLED=0
RUN go install -ldflags "-s -w" github.com/minio/mc@${MC_VERSION}

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /go/bin/mc /usr/bin/mc
ENTRYPOINT ["mc"]
