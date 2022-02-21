#ARG BUILD_FROM="alpine:latest"
ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

WORKDIR /

# Install requirements for add-on
RUN apk update
RUN apk add --no-cache jq npm make gcc g++ python3 linux-headers udev
#&& \
#    npm init -f && \
#    npm install mqtt
#RUN npm install serialport --build-from-source=serialport

COPY package.json /
RUN npm install

# Copy data for add-on
COPY run.sh /
COPY js /js

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
