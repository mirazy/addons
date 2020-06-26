ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apk add --no-cache python3
RUN apk add --no-cache py3-pip

RUN python3 -m pip install pyserial
RUN python3 -m pip install paho-mqtt

WORKDIR /share

COPY . /srv
RUN chmod a+x /srv/run_addon.sh

CMD [ "/srv/run_addon.sh" ]
