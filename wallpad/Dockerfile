#ARG BUILD_FROM="alpine:3.12.9"
#ARG BUILD_FROM
#FROM $BUILD_FROM
FROM python:3

ENV LANG C.UTF-8

RUN python3 -m pip install pyserial
RUN python3 -m pip install paho-mqtt

# Install requirements for add-on
#RUN apk add --no-cache jq npm make gcc g++ python linux-headers udev && \
#    npm init -f && \
#    npm install mqtt && \
#    npm install serialport --build-from-source=serialport

# Copy data for add-on
COPY run.sh /
COPY js /js

RUN chmod a+x /run.sh

WORKDIR /share

CMD [ "/run.sh" ]
