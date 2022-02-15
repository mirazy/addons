#ARG BUILD_FROM="alpine:3.12.9"
#ARG BUILD_FROM
#FROM $BUILD_FROM
FROM alpine:3.12

ENV LANG C.UTF-8

# Copy data for add-on
COPY run.sh /
COPY js /js

WORKDIR /share

# Install requirements for add-on
RUN apk add --no-cache jq npm make gcc g++ python linux-headers udev && \
    npm init -f && \
    npm install mqtt && \
    npm install serialport --build-from-source=serialport

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
