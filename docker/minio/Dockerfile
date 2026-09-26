# MinIO community server — kaynaktan derlenir.
#
# Neden: MinIO community binary dağıtımını durdurdu (source-only). Eski
# quay.io/minio/minio reposu çekişlere 401 veriyor, Docker Hub kopyaları
# kaldırıldı, quay.io/minio/aistor/* ise lisans istiyor. Bu yüzden CI'da
# kaynaktan derleyip ghcr.io/asbajans/rahatio/minio adresine push'lıyoruz.
# Kaynak: https://github.com/minio/minio (AGPLv3) — resmi yöntem:
#   go install github.com/minio/minio@latest
#
# Kullanım: docker build -f docker/minio/Dockerfile -t ghcr.io/asbajans/rahatio/minio:latest .

FROM golang:1.24-bookworm AS build
ARG MINIO_VERSION=latest
ENV CGO_ENABLED=0
RUN go install -ldflags "-s -w" github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.21
RUN apk add --no-cache ca-certificates curl
COPY --from=build /go/bin/minio /usr/bin/minio
COPY docker/minio/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
RUN chmod +x /usr/bin/docker-entrypoint.sh
EXPOSE 9000 9001
ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["minio"]
