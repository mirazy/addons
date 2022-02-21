/**
 * Y-City Home Controller
 * @author Daehwan, Kang
 * @since 2018-09-18
 */

const util = require('util');
const SerialPort = require('serialport');
const net = require('net');   // Socket
const Delimiter = require('@serialport/parser-delimiter');
const mqtt = require('mqtt');

const CONFIG = require('/data/options.json');  //**** 애드온의 옵션을 불러옵니다. 이후 CONFIG.mqtt.username 과 같이 사용가능합니다. 
 
String.prototype.toBuffer = function () {
    var noSpaceStr = this.replace(/\s/gi, '');
    if ((noSpaceStr.length % 2) !== 0) return console.log('error with hex ', this, ' length invalid');
    return Buffer.alloc((noSpaceStr.length / 2), noSpaceStr, 'hex');
};

const checkStateSingleValue = (state, buffer) => {
    return buffer.length + 1 === state.statePrefixHex[1] &&
        state.statePrefixHex.compare(buffer, 0, state.statePrefixHex.length) === 0 &&
        buffer[state.stateIndex] === state.stateCode;
};

const checkStateAndUpdate = (state, buffer) => {
    var result = buffer.length + 1 === state.statePrefixHex[1] && state.statePrefixHex.compare(buffer, 0, state.statePrefixHex.length) === 0;
    if (result) state.state = buffer[state.stateIndex].toString();
    return result;
};

const checkStateAndAction = (state, buffer) => {
    var result = buffer.length + 1 === state.statePrefixHex[1] && state.statePrefixHex.compare(buffer, 0, state.statePrefixHex.length) === 0;
    if (result) {
        if (buffer[state.stateIndex + 1] < buffer[state.stateIndex + 2]) {
            state.state = "heating";
        }
        else {
            state.state = "idle";
        }
    }
    return result;
};

const CONST = {
    // 연결종류. 아래 정의 내용에 따라 소켓을 열거나 USB시리얼포트를 이용한다
    portType: 'socket',
    portHeader: '[socket]',
	idleDuration: 500,
    // 포트이름 설정/dev/ttyUSB0
    portName: process.platform.startsWith('win') ? "COM6" : CONFIG.serial.port,
    // SerialPort 전송 Delay(ms)
    sendDelay: CONFIG.sendDelay,
    // MQTT 브로커
    mqttBroker: 'mqtt://' + CONFIG.mqtt.server, // *************** 환경에 맞게 수정하세요! **************
    // MQTT 수신 Delay(ms)
    mqttDelay: CONFIG.mqtt.receiveDelay,

    mqttUser: CONFIG.mqtt.username,  // *************** 환경에 맞게 수정하세요! **************
    mqttPass: CONFIG.mqtt.password, // *************** 환경에 맞게 수정하세요! **************

    clientID: CONFIG.model + '-homenet',

    // MQTT Discovery Config
    // https://www.home-assistant.io/docs/mqtt/discovery/
    // http://mqtt-explorer.com
    DEVICE_CONFIG: {
        //'light/homenet/panel1-1': { name: 'livingroom_light1', unique_id: 'light-homenet-panel1-1', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel1-2': { name: 'livingroom_light2', unique_id: 'light-homenet-panel1-2', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel1-3': { name: 'livingroom_light3', unique_id: 'light-homenet-panel1-3', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel1-4': { name: 'livingroom_light4', unique_id: 'light-homenet-panel1-4', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel2-1': { name: 'room1_light1', unique_id: 'light-homenet-panel2-1', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel2-2': { name: 'room1_light2', unique_id: 'light-homenet-panel2-2', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel3-1': { name: 'room2_light1', unique_id: 'light-homenet-panel3-1', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel4-1': { name: 'room3_light1', unique_id: 'light-homenet-panel4-1', state_topic: '~/power/state', command_topic: '~/power/command' },
        //'light/homenet/panel5-1': { name: 'room4_light1', unique_id: 'light-homenet-panel5-1', state_topic: '~/power/state', command_topic: '~/power/command' },

        'fan/homenet/panel1': { name: '환풍기', unique_id: 'fan-homenet-panel1', state_topic: '~/power/state', command_topic: '~/power/command', speed_state_topic: '~/speed/state', speed_command_topic: '~/speed/command', speeds:['low', 'medium', 'high'] },

        //'switch/homenet/breaker1': { name: 'gas_breaker', unique_id: 'switch-homenet-breaker1', state_topic: '~/gas/state', command_topic: '~/gas/command' },
        //'switch/homenet/breaker2-1': { name: 'absence_mode_light', unique_id: 'switch-homenet-breaker2-1', state_topic: '~/light/state', command_topic: '~/light/command' },
        //'switch/homenet/breaker2-2': { name: 'absence_mode_gas', unique_id: 'switch-homenet-breaker2-2', state_topic: '~/gas/state', command_topic: '~/gas/command' },

        //'climate/homenet/heater1-1': { name: 'livingroom', unique_id: 'climate-homenet-heater1-1', modes: ['off','heat_cool','heat'], action_topic: '~/action/state', current_temperature_topic: '~/current_temperature/state', mode_state_topic: '~/mode/state', mode_command_topic: '~/mode/command', temperature_state_topic: '~/temperature/state', temperature_command_topic: '~/temperature/command', precision: 1.0 },
        //'climate/homenet/heater1-2': { name: 'bedroom', unique_id: 'climate-homenet-heater1-2', modes: ['off','heat_cool','heat'], action_topic: '~/action/state', current_temperature_topic: '~/current_temperature/state', mode_state_topic: '~/mode/state', mode_command_topic: '~/mode/command', temperature_state_topic: '~/temperature/state', temperature_command_topic: '~/temperature/command', precision: 1.0 },
        //'climate/homenet/heater1-3': { name: 'roomA', unique_id: 'climate-homenet-heater1-3', modes: ['off','heat_cool','heat'], action_topic: '~/action/state', current_temperature_topic: '~/current_temperature/state', mode_state_topic: '~/mode/state', mode_command_topic: '~/mode/command', temperature_state_topic: '~/temperature/state', temperature_command_topic: '~/temperature/command', precision: 1.0 },
        //'climate/homenet/heater1-4': { name: 'roomB', unique_id: 'climate-homenet-heater1-4', modes: ['off','heat_cool','heat'], action_topic: '~/action/state', current_temperature_topic: '~/current_temperature/state', mode_state_topic: '~/mode/state', mode_command_topic: '~/mode/command', temperature_state_topic: '~/temperature/state', temperature_command_topic: '~/temperature/command', precision: 1.0 },

        'binary_sensor/homenet/wallpad': { name: 'wallpad', unique_id: 'binary_sensor-homenet-wallpad', device_class: 'connectivity', state_topic: '~/connectivity/state' }
    },

    // 기기별 상태 및 제어 코드(HEX)
    // https://mscg.kr/entry/월패드-코콤-월패드-및-그렉스-환기장치-RS485-패킷
    // CheckSum8 Xor: https://www.scadacore.com/tools/programming-calculators/online-checksum-calculator/
    // HNT-3100 Series 현대통신향 패킷구조
    //    0      1    2     3      4        5      6    7  
    // Header Length 01 DeviceID CmdType StateID SubID 00 DATA XOR ee
    // DeviceID 전등스위치 19
    //          가스벨브   1b
    //          외출차단기 2a
    //          환풍기     2b
    //          난방       18
    // CmdType  상태요청   01
    //          상태변경   02
    //          상태응답   04
    // StateID  ON/OFF     40
    //          속도       42
    //          밸브       43
    //          난방       46
    // SubID    전등       패널: { 10, 20, 30, 40 } | 패널1-스위치1: 11, 패널3-스위치2: 32 
    //          가스벨브   패널: 10
    //          환풍기     패널: 10
    //          차단기     10, 11
    // DATA     전등       ON: 01 | OFF: 02
    //          가스차잔   ON: 03 | OFF: 04
    //          환풍기     ON: 01 | OFF: 02 || low: 01 | medium: 03 | high: 07
    //          난방       ON: 01 | OFF: 04(완전꺼짐이며, 대림 앱 제어시) | 외출: 07(물리제어시) || 현재온도 || 희망온도
    DEVICE_STATE: [
        // light panel1: f7 0f 01 19 04 40 10   00 02 02 02 02 02	                                                        
        //{ base_topic: 'light/homenet/panel1-1', statePrefixHex: 'f7 0b 01 19 04 40 11 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel1-1', statePrefixHex: 'f7 0b 01 19 04 40 11 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel1-2', statePrefixHex: 'f7 0b 01 19 04 40 12 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel1-2', statePrefixHex: 'f7 0b 01 19 04 40 12 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel1-3', statePrefixHex: 'f7 0b 01 19 04 40 13 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel1-3', statePrefixHex: 'f7 0b 01 19 04 40 13 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel1-4', statePrefixHex: 'f7 0b 01 19 04 40 14 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel1-4', statePrefixHex: 'f7 0b 01 19 04 40 14 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel1-5', statePrefixHex: 'f7 0b 01 19 04 40 15 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel1-5', statePrefixHex: 'f7 0b 01 19 04 40 15 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },

        // light panel2: f7 0c 01 19 04 40 20   00 02 02
        //{ base_topic: 'light/homenet/panel2-1', statePrefixHex: 'f7 0b 01 19 04 40 21 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel2-1', statePrefixHex: 'f7 0b 01 19 04 40 21 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel2-2', statePrefixHex: 'f7 0b 01 19 04 40 22 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel2-2', statePrefixHex: 'f7 0b 01 19 04 40 22 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },

        // light panel3: f7 0c 01 19 04 40 30   00 02 02
        //{ base_topic: 'light/homenet/panel3-1', statePrefixHex: 'f7 0b 01 19 04 40 31 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel3-1', statePrefixHex: 'f7 0b 01 19 04 40 31 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel3-2', statePrefixHex: 'f7 0b 01 19 04 40 32 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel3-2', statePrefixHex: 'f7 0b 01 19 04 40 32 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },

        // light panel4: f7 0c 01 19 04 40 40   00 02 02
        //{ base_topic: 'light/homenet/panel4-1', statePrefixHex: 'f7 0b 01 19 04 40 41 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel4-1', statePrefixHex: 'f7 0b 01 19 04 40 41 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel4-2', statePrefixHex: 'f7 0b 01 19 04 40 42 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel4-2', statePrefixHex: 'f7 0b 01 19 04 40 42 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },

        // light panel5: f7 0c 01 19 04 40 50   00 02 02        
        //{ base_topic: 'light/homenet/panel5-1', statePrefixHex: 'f7 0b 01 19 04 40 51 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel5-1', statePrefixHex: 'f7 0b 01 19 04 40 51 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },
        //{ base_topic: 'light/homenet/panel5-2', statePrefixHex: 'f7 0b 01 19 04 40 52 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x02, stateName: 'power', state: 'OFF' },
        //{ base_topic: 'light/homenet/panel5-2', statePrefixHex: 'f7 0b 01 19 04 40 52 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'power', state: 'ON' },

        // breaker1(gas): f7 0d 01 1b 04 43 10   00 04 00 00 b3
        //{ base_topic: 'switch/homenet/breaker1', statePrefixHex: 'f7 0d 01 1b 04 43 10 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'gas', state: 'OFF' },
        //{ base_topic: 'switch/homenet/breaker1', statePrefixHex: 'f7 0d 01 1b 04 43 10 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x03, stateName: 'gas', state: 'ON' },

        // breaker2(away): f7 0e 01 2a 04 40 10   00 19 02 1b 04 82
        //{ base_topic: 'switch/homenet/breaker2-1', statePrefixHex: 'f7 0e 01 2a 04 40 10 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 9, stateCode: 0x02, stateName: 'light', state: 'OFF' },
        //{ base_topic: 'switch/homenet/breaker2-1', statePrefixHex: 'f7 0e 01 2a 04 40 10 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 9, stateCode: 0x01, stateName: 'light', state: 'ON' },
        //{ base_topic: 'switch/homenet/breaker2-2', statePrefixHex: 'f7 0e 01 2a 04 40 10 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 11, stateCode: 0x04, stateName: 'gas', state: 'OFF' },
        //{ base_topic: 'switch/homenet/breaker2-2', statePrefixHex: 'f7 0e 01 2a 04 40 10 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 11, stateCode: 0x03, stateName: 'gas', state: 'ON' },
		
		////////////////////////////////////////////////////////////////////////////////////
		/*
        // breaker2(away-light): f7 0c 01 2a 04 40 11   00 19 02 9e
        { base_topic: 'switch/homenet/breaker2-1', statePrefixHex: 'f7 0c 01 2a 04 40 11 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 9, stateCode: 0x02, stateName: 'light', state: 'OFF' },
        { base_topic: 'switch/homenet/breaker2-1', statePrefixHex: 'f7 0c 01 2a 04 40 11 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 9, stateCode: 0x01, stateName: 'light', state:  'ON' },
        // breaker2(away-gas): f7 0c 01 2a 04 43 11   00 1b 04 99
        { base_topic: 'switch/homenet/breaker2-2', statePrefixHex: 'f7 0c 01 2a 04 43 11 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 9, stateCode: 0x04, stateName: 'gas', state: 'OFF' },
        { base_topic: 'switch/homenet/breaker2-2', statePrefixHex: 'f7 0c 01 2a 04 43 11 00'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 9, stateCode: 0x03, stateName: 'gas', state:  'ON' },
  
        // heater1: f7 22 01 18 04 46 10   00 01 1a 14 01 1a 12 01 1b 0c 01 1b 0c 00000000000000000000000098
        //   room1 mode: away
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'away_mode', state: 'ON' },
        //   room1 mode: home
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'away_mode', state: 'OFF' },
        //   room1 temperature
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateAndAction, stateIndex: 8, stateName: 'action', state: 'idle' },
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 9, stateName: 'current_temperature', state: '22' },
        { base_topic: 'climate/homenet/heater1-1', statePrefixHex: 'f7 0d 01 18 04 46 11'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 10, stateName: 'temperature', state: '22' },
        //   room2 mode: away
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'away_mode', state: 'ON' },
        //   room2 mode: home
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'away_mode', state: 'OFF' },
        //   room2 temperature
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateAndAction, stateIndex: 8, stateName: 'action', state: 'idle' },
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 9, stateName: 'current_temperature', state: '22' },
        { base_topic: 'climate/homenet/heater1-2', statePrefixHex: 'f7 0d 01 18 04 46 12'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 10, stateName: 'temperature', state: '22' },
        //   room3 mode: away
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'away_mode', state: 'ON' },
        //   room3 mode: home
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'away_mode', state: 'OFF' },
        //   room3 temperature
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateAndAction, stateIndex: 8, stateName: 'action', state: 'idle' },
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 9, stateName: 'current_temperature', state: '22' },
        { base_topic: 'climate/homenet/heater1-3', statePrefixHex: 'f7 0d 01 18 04 46 13'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 10, stateName: 'temperature', state: '22' },
        //   room4 mode: away
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x04, stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x07, stateName: 'away_mode', state: 'ON' },
        //   room4 mode: home
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateSingleValue, stateIndex: 8, stateCode: 0x01, stateName: 'away_mode', state: 'OFF' },
        //   room4 temperature
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateAndAction, stateIndex: 8, stateName: 'action', state: 'idle' },
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 9, stateName: 'current_temperature', state: '22' },
        { base_topic: 'climate/homenet/heater1-4', statePrefixHex: 'f7 0d 01 18 04 46 14'.toBuffer(), checkState: checkStateAndUpdate, stateIndex: 10, stateName: 'temperature', state: '22' },
	    */
    ],

    DEVICE_COMMAND: [
        /*
        { base_topic: 'light/homenet/panel1-1', commandHex: 'f7 0b 01 19 02 40 11 02 00 b5 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 11 02 02 b1'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel1-1', commandHex: 'f7 0b 01 19 02 40 11 01 00 b6 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 11 01 01 b1'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel1-2', commandHex: 'f7 0b 01 19 02 40 12 02 00 b6 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 12 02 02 b2'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel1-2', commandHex: 'f7 0b 01 19 02 40 12 01 00 b5 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 12 01 01 b2'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel1-3', commandHex: 'f7 0b 01 19 02 40 13 02 00 b7 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 13 02 02 b3'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel1-3', commandHex: 'f7 0b 01 19 02 40 13 01 00 b4 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 13 01 01 b3'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel1-4', commandHex: 'f7 0b 01 19 02 40 14 02 00 b0 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 14 02 02 b4'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel1-4', commandHex: 'f7 0b 01 19 02 40 14 01 00 b3 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 14 01 01 b4'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel1-5', commandHex: 'f7 0b 01 19 02 40 15 02 00 b1 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 15 02 02 b5'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel1-5', commandHex: 'f7 0b 01 19 02 40 15 01 00 b2 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 15 01 01 b5'.toBuffer(), stateName: 'power', state: 'ON' },

        { base_topic: 'light/homenet/panel2-1', commandHex: 'f7 0b 01 19 02 40 21 02 00 85 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 21 02 02 81'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel2-1', commandHex: 'f7 0b 01 19 02 40 21 01 00 86 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 21 01 01 81'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel2-2', commandHex: 'f7 0b 01 19 02 40 22 02 00 86 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 22 02 02 82'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel2-2', commandHex: 'f7 0b 01 19 02 40 22 01 00 85 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 22 01 01 82'.toBuffer(), stateName: 'power', state: 'ON' },

        { base_topic: 'light/homenet/panel3-1', commandHex: 'f7 0b 01 19 02 40 31 02 00 95 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 31 02 02 91'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel3-1', commandHex: 'f7 0b 01 19 02 40 31 01 00 96 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 31 01 01 91'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel3-2', commandHex: 'f7 0b 01 19 02 40 32 02 00 96 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 32 02 02 92'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel3-2', commandHex: 'f7 0b 01 19 02 40 32 01 00 95 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 32 01 01 92'.toBuffer(), stateName: 'power', state: 'ON' },

        { base_topic: 'light/homenet/panel4-1', commandHex: 'f7 0b 01 19 02 40 41 02 00 e5 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 41 02 02 e1'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel4-1', commandHex: 'f7 0b 01 19 02 40 41 01 00 e6 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 41 01 01 e1'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel4-2', commandHex: 'f7 0b 01 19 02 40 42 02 00 e6 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 42 02 02 e2'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel4-2', commandHex: 'f7 0b 01 19 02 40 42 01 00 e5 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 42 01 01 e2'.toBuffer(), stateName: 'power', state: 'ON' },

        { base_topic: 'light/homenet/panel5-1', commandHex: 'f7 0b 01 19 02 40 51 02 00 f5 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 51 02 02 f1'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel5-1', commandHex: 'f7 0b 01 19 02 40 51 01 00 f6 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 51 01 01 f1'.toBuffer(), stateName: 'power', state: 'ON' },
        { base_topic: 'light/homenet/panel5-1', commandHex: 'f7 0b 01 19 02 40 52 02 00 f6 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 51 02 02 f2'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'light/homenet/panel5-1', commandHex: 'f7 0b 01 19 02 40 52 01 00 f5 ee'.toBuffer(), ackHex: 'f7 0b 01 19 04 40 51 01 01 f2'.toBuffer(), stateName: 'power', state: 'ON' },

        { base_topic: 'switch/homenet/breaker1', commandHex: 'f7 0b 01 1b 02 43 11 04 00 b2 ee'.toBuffer(), ackHex: 'f7 0b 01 1b 04 43 11 04 04 b0'.toBuffer(), stateName: 'gas', state: 'MANUAL' },
        { base_topic: 'switch/homenet/breaker1', commandHex: 'f7 0b 01 1b 02 43 11 03 00 b5 ee'.toBuffer(), ackHex: 'f7 0b 01 1b 04 43 11 03 03 b0'.toBuffer(), stateName: 'gas', state: 'ON' },

        { base_topic: 'switch/homenet/breaker2-1', commandHex: 'f7 0c 01 2a 02 40 11 02 19 00 98 ee'.toBuffer(), ackHex: 'f7 0c 01 2a 04 40 11 02 19 02 9c'.toBuffer(), stateName: 'light', state: 'OFF' },
        { base_topic: 'switch/homenet/breaker2-1', commandHex: 'f7 0c 01 2a 02 40 11 01 19 00 9b ee'.toBuffer(), ackHex: 'f7 0c 01 2a 04 40 11 01 19 01 9c'.toBuffer(), stateName: 'light', state: 'ON' },
        { base_topic: 'switch/homenet/breaker2-2', commandHex: 'f7 0c 01 2a 02 43 11 04 1b 00 9f ee'.toBuffer(), ackHex: 'f7 0c 01 2a 04 43 11 04 1b 04 9d'.toBuffer(), stateName: 'gas', state: 'MANUAL' },
        { base_topic: 'switch/homenet/breaker2-2', commandHex: 'f7 0c 01 2a 02 43 11 03 1b 00 98 ee'.toBuffer(), ackHex: 'f7 0c 01 2a 04 43 11 03 1b 03 9d'.toBuffer(), stateName: 'gas', state: 'ON' },
        */
		////////////////////////////////////////////////////////////////////////////////////
         
        { base_topic: 'fan/homenet/panel1', commandHex: 'f7 0b 01 2b 02 40 11 02 00 87 ee'.toBuffer(), ackHex: 'f7 0c 01 2b 04 41 2b 04 40 11 00 02 07 81'.toBuffer(), stateName: 'power', state: 'OFF' },
        { base_topic: 'fan/homenet/panel1', commandHex: 'f7 0b 01 2b 02 42 11 01 00 86 ee'.toBuffer(), ackHex: 'f7 0c 01 2b 04 41 2b 04 40 11 00 01 01 84'.toBuffer(), stateName: 'power', state:  'ON' },
        
        { base_topic: 'fan/homenet/panel1', commandHex: 'f7 0b 01 2b 02 42 11 01 00 86 ee'.toBuffer(), ackHex: 'f7 0c 01 2b 04 41 2b 04 40 11 00 01 01 84'.toBuffer(), stateName: 'speed', state:    'low' },
        { base_topic: 'fan/homenet/panel1', commandHex: 'f7 0b 01 2b 02 42 11 03 00 84 ee'.toBuffer(), ackHex: 'f7 0c 01 2b 04 41 2b 04 40 11 00 01 03 86'.toBuffer(), stateName: 'speed', state: 'medium' },
        { base_topic: 'fan/homenet/panel1', commandHex: 'f7 0b 01 2b 02 42 11 07 00 80 ee'.toBuffer(), ackHex: 'f7 0c 01 2b 04 41 2b 04 40 11 00 01 07 82'.toBuffer(), stateName: 'speed', state:   'high' },
        /*
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 46 11 01 00 b1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 11 01 01'.toBuffer(), stateName: 'away_mode', state: 'OFF' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 46 11 04 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 11 04 04'.toBuffer(), stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 46 12 01 00 b2 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 12 01 01'.toBuffer(), stateName: 'away_mode', state: 'OFF' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 46 12 04 00 b7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 12 04 04'.toBuffer(), stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 46 13 01 00 b3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 13 01 01'.toBuffer(), stateName: 'away_mode', state: 'OFF' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 46 13 04 00 b6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 13 04 04'.toBuffer(), stateName: 'away_mode', state: 'ON' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 46 14 01 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 14 01 01'.toBuffer(), stateName: 'away_mode', state: 'OFF' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 46 14 04 00 b1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 14 04 04'.toBuffer(), stateName: 'away_mode', state: 'ON' },

        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 46 11 01 00 b1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 11 01 01'.toBuffer(), stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 46 11 04 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 11 04 04'.toBuffer(), stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 07 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 07'.toBuffer(), stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 46 12 01 00 b2 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 12 01 01'.toBuffer(), stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 46 12 04 00 b7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 12 04 04'.toBuffer(), stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 07 00 b7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 07'.toBuffer(), stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 46 13 01 00 b3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 13 01 01'.toBuffer(), stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 46 13 04 00 b6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 13 04 04'.toBuffer(), stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 07 00 b6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 07'.toBuffer(), stateName: 'mode', state: 'heat_cool' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 46 14 01 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 14 01 01'.toBuffer(), stateName: 'mode', state: 'heat' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 46 14 04 00 b1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 46 14 04 04'.toBuffer(), stateName: 'mode', state: 'off' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 07 00 b1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 07'.toBuffer(), stateName: 'mode', state: 'heat_cool' },

        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 05 00 b6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 05'.toBuffer(), stateName: 'temperature', state: '5.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 06 00 b5 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 06'.toBuffer(), stateName: 'temperature', state: '6.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 07 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 07'.toBuffer(), stateName: 'temperature', state: '7.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 08 00 bb ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 08'.toBuffer(), stateName: 'temperature', state: '8.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 09 00 ba ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 09'.toBuffer(), stateName: 'temperature', state: '9.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 0a 00 b9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 0a'.toBuffer(), stateName: 'temperature', state: '10.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 0b 00 b8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 0b'.toBuffer(), stateName: 'temperature', state: '11.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 0c 00 bf ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 0c'.toBuffer(), stateName: 'temperature', state: '12.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 0d 00 be ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 0d'.toBuffer(), stateName: 'temperature', state: '13.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 0e 00 bd ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 0e'.toBuffer(), stateName: 'temperature', state: '14.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 0f 00 bc ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 0f'.toBuffer(), stateName: 'temperature', state: '15.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 10 00 a3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 10'.toBuffer(), stateName: 'temperature', state: '16.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 11 00 a2 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 11'.toBuffer(), stateName: 'temperature', state: '17.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 12 00 a1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 12'.toBuffer(), stateName: 'temperature', state: '18.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 13 00 a0 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 13'.toBuffer(), stateName: 'temperature', state: '19.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 14 00 a7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 14'.toBuffer(), stateName: 'temperature', state: '20.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 15 00 a6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 15'.toBuffer(), stateName: 'temperature', state: '21.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 16 00 a5 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 16'.toBuffer(), stateName: 'temperature', state: '22.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 17 00 a4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 17'.toBuffer(), stateName: 'temperature', state: '23.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 18 00 ab ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 18'.toBuffer(), stateName: 'temperature', state: '24.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 19 00 aa ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 19'.toBuffer(), stateName: 'temperature', state: '25.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 1a 00 a9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 1a'.toBuffer(), stateName: 'temperature', state: '26.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 1b 00 a8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 1b'.toBuffer(), stateName: 'temperature', state: '27.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 1c 00 af ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 1c'.toBuffer(), stateName: 'temperature', state: '28.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 1d 00 ae ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 1d'.toBuffer(), stateName: 'temperature', state: '29.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 1e 00 ad ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 1e'.toBuffer(), stateName: 'temperature', state: '30.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 1f 00 ac ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 1f'.toBuffer(), stateName: 'temperature', state: '31.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 20 00 93 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 20'.toBuffer(), stateName: 'temperature', state: '32.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 21 00 92 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 21'.toBuffer(), stateName: 'temperature', state: '33.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 22 00 91 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 22'.toBuffer(), stateName: 'temperature', state: '34.0' },
        { base_topic: 'climate/homenet/heater1-1', commandHex: 'f7 0b 01 18 02 45 11 23 00 90 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 11 23'.toBuffer(), stateName: 'temperature', state: '35.0' },

        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 05 00 b5 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 05'.toBuffer(), stateName: 'temperature', state: '5.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 06 00 b6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 06'.toBuffer(), stateName: 'temperature', state: '6.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 07 00 b7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 07'.toBuffer(), stateName: 'temperature', state: '7.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 08 00 b8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 08'.toBuffer(), stateName: 'temperature', state: '8.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 09 00 b9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 09'.toBuffer(), stateName: 'temperature', state: '9.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 0a 00 ba ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 0a'.toBuffer(), stateName: 'temperature', state: '10.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 0b 00 bb ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 0b'.toBuffer(), stateName: 'temperature', state: '11.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 0c 00 bc ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 0c'.toBuffer(), stateName: 'temperature', state: '12.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 0d 00 bd ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 0d'.toBuffer(), stateName: 'temperature', state: '13.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 0e 00 be ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 0e'.toBuffer(), stateName: 'temperature', state: '14.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 0f 00 bf ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 0f'.toBuffer(), stateName: 'temperature', state: '15.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 10 00 a0 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 10'.toBuffer(), stateName: 'temperature', state: '16.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 11 00 a1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 11'.toBuffer(), stateName: 'temperature', state: '17.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 12 00 a2 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 12'.toBuffer(), stateName: 'temperature', state: '18.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 13 00 a3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 13'.toBuffer(), stateName: 'temperature', state: '19.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 14 00 a4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 14'.toBuffer(), stateName: 'temperature', state: '20.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 15 00 a5 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 15'.toBuffer(), stateName: 'temperature', state: '21.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 16 00 a6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 16'.toBuffer(), stateName: 'temperature', state: '22.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 17 00 a7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 17'.toBuffer(), stateName: 'temperature', state: '23.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 18 00 a8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 18'.toBuffer(), stateName: 'temperature', state: '24.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 19 00 a9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 19'.toBuffer(), stateName: 'temperature', state: '25.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 1a 00 aa ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 1a'.toBuffer(), stateName: 'temperature', state: '26.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 1b 00 ab ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 1b'.toBuffer(), stateName: 'temperature', state: '27.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 1c 00 ac ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 1c'.toBuffer(), stateName: 'temperature', state: '28.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 1d 00 ad ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 1d'.toBuffer(), stateName: 'temperature', state: '29.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 1e 00 ae ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 1e'.toBuffer(), stateName: 'temperature', state: '30.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 1f 00 af ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 1f'.toBuffer(), stateName: 'temperature', state: '31.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 20 00 90 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 20'.toBuffer(), stateName: 'temperature', state: '32.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 21 00 91 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 21'.toBuffer(), stateName: 'temperature', state: '33.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 22 00 92 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 22'.toBuffer(), stateName: 'temperature', state: '34.0' },
        { base_topic: 'climate/homenet/heater1-2', commandHex: 'f7 0b 01 18 02 45 12 23 00 93 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 12 23'.toBuffer(), stateName: 'temperature', state: '35.0' },

        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 05 00 b4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 05'.toBuffer(), stateName: 'temperature', state: '5.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 06 00 b7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 06'.toBuffer(), stateName: 'temperature', state: '6.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 07 00 b6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 07'.toBuffer(), stateName: 'temperature', state: '7.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 08 00 b9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 08'.toBuffer(), stateName: 'temperature', state: '8.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 09 00 b8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 09'.toBuffer(), stateName: 'temperature', state: '9.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 0a 00 bb ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 0a'.toBuffer(), stateName: 'temperature', state: '10.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 0b 00 ba ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 0b'.toBuffer(), stateName: 'temperature', state: '11.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 0c 00 bd ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 0c'.toBuffer(), stateName: 'temperature', state: '12.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 0d 00 bc ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 0d'.toBuffer(), stateName: 'temperature', state: '13.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 0e 00 bf ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 0e'.toBuffer(), stateName: 'temperature', state: '14.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 0f 00 be ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 0f'.toBuffer(), stateName: 'temperature', state: '15.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 10 00 a1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 10'.toBuffer(), stateName: 'temperature', state: '16.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 11 00 a0 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 11'.toBuffer(), stateName: 'temperature', state: '17.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 12 00 a3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 12'.toBuffer(), stateName: 'temperature', state: '18.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 13 00 a2 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 13'.toBuffer(), stateName: 'temperature', state: '19.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 14 00 a5 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 14'.toBuffer(), stateName: 'temperature', state: '20.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 15 00 a4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 15'.toBuffer(), stateName: 'temperature', state: '21.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 16 00 a7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 16'.toBuffer(), stateName: 'temperature', state: '22.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 17 00 a6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 17'.toBuffer(), stateName: 'temperature', state: '23.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 18 00 a9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 18'.toBuffer(), stateName: 'temperature', state: '24.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 19 00 a8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 19'.toBuffer(), stateName: 'temperature', state: '25.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 1a 00 ab ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 1a'.toBuffer(), stateName: 'temperature', state: '26.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 1b 00 aa ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 1b'.toBuffer(), stateName: 'temperature', state: '27.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 1c 00 ad ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 1c'.toBuffer(), stateName: 'temperature', state: '28.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 1d 00 ac ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 1d'.toBuffer(), stateName: 'temperature', state: '29.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 1e 00 af ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 1e'.toBuffer(), stateName: 'temperature', state: '30.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 1f 00 ae ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 1f'.toBuffer(), stateName: 'temperature', state: '31.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 20 00 91 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 20'.toBuffer(), stateName: 'temperature', state: '32.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 21 00 90 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 21'.toBuffer(), stateName: 'temperature', state: '33.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 22 00 93 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 22'.toBuffer(), stateName: 'temperature', state: '34.0' },
        { base_topic: 'climate/homenet/heater1-3', commandHex: 'f7 0b 01 18 02 45 13 23 00 92 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 13 23'.toBuffer(), stateName: 'temperature', state: '35.0' },

        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 05 00 b3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 05'.toBuffer(), stateName: 'temperature', state: '5.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 06 00 b0 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 06'.toBuffer(), stateName: 'temperature', state: '6.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 07 00 b1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 07'.toBuffer(), stateName: 'temperature', state: '7.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 08 00 be ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 08'.toBuffer(), stateName: 'temperature', state: '8.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 09 00 bf ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 09'.toBuffer(), stateName: 'temperature', state: '9.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 0a 00 bc ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 0a'.toBuffer(), stateName: 'temperature', state: '10.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 0b 00 bd ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 0b'.toBuffer(), stateName: 'temperature', state: '11.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 0c 00 ba ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 0c'.toBuffer(), stateName: 'temperature', state: '12.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 0d 00 bb ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 0d'.toBuffer(), stateName: 'temperature', state: '13.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 0e 00 b8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 0e'.toBuffer(), stateName: 'temperature', state: '14.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 0f 00 b9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 0f'.toBuffer(), stateName: 'temperature', state: '15.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 10 00 a6 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 10'.toBuffer(), stateName: 'temperature', state: '16.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 11 00 a7 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 11'.toBuffer(), stateName: 'temperature', state: '17.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 12 00 a4 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 12'.toBuffer(), stateName: 'temperature', state: '18.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 13 00 a5 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 13'.toBuffer(), stateName: 'temperature', state: '19.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 14 00 a2 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 14'.toBuffer(), stateName: 'temperature', state: '20.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 15 00 a3 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 15'.toBuffer(), stateName: 'temperature', state: '21.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 16 00 a0 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 16'.toBuffer(), stateName: 'temperature', state: '22.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 17 00 a1 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 17'.toBuffer(), stateName: 'temperature', state: '23.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 18 00 ae ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 18'.toBuffer(), stateName: 'temperature', state: '24.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 19 00 af ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 19'.toBuffer(), stateName: 'temperature', state: '25.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 1a 00 ac ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 1a'.toBuffer(), stateName: 'temperature', state: '26.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 1b 00 ad ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 1b'.toBuffer(), stateName: 'temperature', state: '27.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 1c 00 aa ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 1c'.toBuffer(), stateName: 'temperature', state: '28.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 1d 00 ab ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 1d'.toBuffer(), stateName: 'temperature', state: '29.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 1e 00 a8 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 1e'.toBuffer(), stateName: 'temperature', state: '30.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 1f 00 a9 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 1f'.toBuffer(), stateName: 'temperature', state: '31.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 20 00 96 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 20'.toBuffer(), stateName: 'temperature', state: '32.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 21 00 97 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 21'.toBuffer(), stateName: 'temperature', state: '33.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 22 00 94 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 22'.toBuffer(), stateName: 'temperature', state: '34.0' },
        { base_topic: 'climate/homenet/heater1-4', commandHex: 'f7 0b 01 18 02 45 14 23 00 95 ee'.toBuffer(), ackHex: 'f7 0d 01 18 04 45 14 23'.toBuffer(), stateName: 'temperature', state: '35.0' }
        */
    ],

    DEVICE_SCHEDULED_REQUEST: [ 
        /*
        { category: 'light/homenet/panel1-1', requestHex: 'f7 0b 01 19 01 40 11 00 00 b4 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel1-2', requestHex: 'f7 0b 01 19 01 40 12 00 00 b7 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel1-3', requestHex: 'f7 0b 01 19 01 40 13 00 00 b6 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel1-4', requestHex: 'f7 0b 01 19 01 40 14 00 00 b1 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel2-1', requestHex: 'f7 0b 01 19 01 40 21 00 00 84 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel2-2', requestHex: 'f7 0b 01 19 01 40 22 00 00 87 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel3-1', requestHex: 'f7 0b 01 19 01 40 31 00 00 94 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel4-1', requestHex: 'f7 0b 01 19 01 40 41 00 00 e4 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        { category: 'light/homenet/panel5-1', requestHex: 'f7 0b 01 19 01 40 51 00 00 f4 ee'.toBuffer(), lastActivity: new Date().getTime() + 5000, lastDelegateActivity: new Date().getTime() + 5000 },
        */
		////////////////////////////////////////////////////////////////////////////////////
        /*
        { category: 'fan/homenet/panel1',   requestHex: 'f7 0b 01 2b 01 40 10 00 00 87'.toBuffer(), lastActivity: new Date().getTime()+10000, lastDelegateActivity: new Date().getTime()+10000 },

        { category: 'switch/homenet/breaker1',   requestHex: 'f7 0b 01 1b 01 43 10 00 00 b4'.toBuffer(), lastActivity: new Date().getTime()+10000, lastDelegateActivity: new Date().getTime()+10000 },
        { category: 'switch/homenet/breaker2-1', requestHex: 'f7 0c 01 2a 01 40 11 00 19 00 99'.toBuffer(), lastActivity: new Date().getTime()+10000, lastDelegateActivity: new Date().getTime()+10000 },
        { category: 'switch/homenet/breaker2-2', requestHex: 'f7 0c 01 2a 01 43 11 00 1b 00 98'.toBuffer(), lastActivity: new Date().getTime()+10000, lastDelegateActivity: new Date().getTime()+10000 },

        { category: 'climate/homenet/heater1', requestHex: 'f7 0b 01 18 01 46 10 00 00 b2'.toBuffer(), lastActivity: new Date().getTime()+10000, lastDelegateActivity: new Date().getTime()+10000 }
		*/
  ], 
    DEVICE_SCHEDULED_REQUEST_NORMAL: { base_topic: 'binary_sensor/homenet/wallpad', stateName: 'connectivity', state: 'ON' },
    DEVICE_SCHEDULED_REQUEST_ABNORMAL: { base_topic: 'binary_sensor/homenet/wallpad', stateName: 'connectivity', state: 'OFF' },

    DEVICE_UNSCHEDULED_REQUEST: [
        //{ category: 'switch/homenet/breaker1', requestHex: 'f7 0b 01 1b 01 43 10 00 00 b4'.toBuffer(), lastActivity: new Date().getTime() + 1000, lastDelegateActivity: new Date().getTime() + 1000 },
        //{ category: 'switch/homenet/breaker2', requestHex: 'f7 0e 01 2a 01 40 10 00 19'.toBuffer(),    lastActivity: new Date().getTime() + 1000, lastDelegateActivity: new Date().getTime() + 1000 },
    ],
    // 이 메시지나 나타난 뒤에 일정시간동안 메시지 송신이 안전하다. 테스트를 통해 아래 종류의 메시지 등장후 idleMilliseconds만큼 여유가 있는지 점검 필요
	// 실제 다음메시지 나오는 시간 - 질의던지고 결과 받을 시간 고려하여 결정 ex)800-200 = 600
    DEVICE_BEFORE_IDLE: [
        //{ category: 'switch/homenet/breaker1', statePrefixHex: 'f7 0d 01 1b 04 43 10 00'.toBuffer() },
        //{ category: 'switch/homenet/breaker2', statePrefixHex: 'f7 0e 01 2a 04 40 10 00 19'.toBuffer() }
    ],
    // 상태 Topic (/homeassistant/${component}/${node_id}/${object_id}/${property}/state/ = ${value})
    // 명령어 Topic (/homeassistant/${component}/${node_id}/${object_id}/${property}/command/ = ${value})
    TOPIC_PREFIX: 'homeassistant',
    STATE_TOPIC: 'homeassistant/%s/%s/state', //상태 전달
    COMMAND_TOPIC: 'homeassistant/+/homenet/+/+/command', //명령 수신

    COMMAND_MAX_RETRY_COUNT: 3
};

//const EE = Uint8Array.of(0xee);
const EE = Buffer.alloc(1, 'ee', 'hex');

var getCheckSum = obj => obj.reduce((a, b) => a ^ b, 0);

var log = (...args) => console.log('[' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ']', args.join(' '));

var humanizeBuffer = buffer => [buffer.toString('hex', 0, 3), buffer.toString('hex', 3, 4), buffer.toString('hex', 4, 5), buffer.toString('hex', 5, 6), buffer.toString('hex', 6, 7), buffer.toString('hex', 7)].join(' ');


///////////////////////////////////////////
// 홈컨트롤 상태
var homeStatus = {};
var lastActivity = new Date().getTime();
var mqttReady = false;
var cmdQueue = [];
var chkQueue = [];
///////////////////////////////////////////
var parser;
///////////////////////////////////////////
var rs485port;
var lastIdleBegin = new Date().getTime();
///////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////
// MQTT-Broker 연결
const client = mqtt.connect(CONST.mqttBroker, {
    clientId: CONST.clientID,
    username: CONST.mqttUser,
    password: CONST.mqttPass
});
client.on('connect', () => {
    log('Initializing: MQTT Client');
    client.subscribe(CONST.COMMAND_TOPIC, (err) => { if (err) log('  MQTT Subscribe fail! -', CONST.COMMAND_TOPIC) });

    // MQTT Discovery Config 추가
    for (let [key, value] of Object.entries(CONST.DEVICE_CONFIG)) {
        value['~'] = CONST.TOPIC_PREFIX + '/' + key;
        client.publish(value['~'] + '/config', JSON.stringify(value), { retain: true });
        log('  MQTT Discovery Config:', value['~']);
    }
});

if (CONST.portType == 'serial') {
    //-----------------------------------------------------------
    // SerialPort 모듈 초기화
    log('Initializing: SERIAL');
    rs485port = new SerialPort(CONST.portName, {
        baudRate: CONFIG.serial.baudrate,
        dataBits: 8,
        parity: CONFIG.serial.parity,
        stopBits: 1,
        autoOpen: false,
        encoding: 'hex'
    });
    parser = rs485port.pipe(new Delimiter({ delimiter: EE }));
    rs485port.on('open', () => log('  Success open port:', CONST.portName));
    rs485port.open((err) => {
        if (err) {
            return log('  Error opening port:', err.message);
        }
    });
}
else {
    // EW11 연결        
    rs485port = new net.Socket();
    log('Initializing: SOCKET', ' delay: ', CONFIG.sendDelay);
    rs485port.connect(CONFIG.socket.port, CONFIG.socket.deviceIP, function () {
        log(CONST.portHeader + ' Success connect server');
    });
    parser = rs485port.pipe(new Delimiter({ delimiter: EE }));
};


//////////////////////////////////////////////////////////////////////////////////////
// RS485 Port에서 데이터 수신
parser.on('data', buffer => {
    //log(CONST.portHeader+' Packet:', buffer.toString('hex'), '(Receive interval:', (new Date().getTime())-lastActivity, 'ms)' );
    lastActivity = new Date().getTime();

    if (buffer[0] != 0xf7) {
        log(CONST.portHeader + ' Packet Error(Header):', buffer.toString('hex', 0, 1), buffer.toString('hex', 1));
        return;
    }
    else if (buffer.length + 1 != buffer[1]) {
        log(CONST.portHeader + ' Packet Error(Length):', buffer.toString('hex', 0, 2), buffer.toString('hex', 2));
        return;
    }
    else if (getCheckSum(buffer.subarray(0, buffer.length - 1)) != buffer[buffer.length - 1]) {
        log(CONST.portHeader + ' Packet Error(Checksum):', buffer.toString('hex', 0, buffer.length - 1), buffer.toString('hex', buffer.length - 1));
        return;
    }

    if (buffer[4] == 0x01) {
        var scheduledRequestFound = CONST.DEVICE_SCHEDULED_REQUEST.find(obj => buffer.length === obj.requestHex.length && obj.requestHex.compare(buffer) === 0);
        if (scheduledRequestFound) {
            log(CONST.portHeader+' Scheduled Request Found:', scheduledRequestFound.category);
            scheduledRequestFound.lastActivity = lastActivity;
        }
        else {
            var unscheduledRequestFound = CONST.DEVICE_UNSCHEDULED_REQUEST.find(obj => buffer.length >= obj.requestHex.length && obj.requestHex.compare(buffer, 0, obj.requestHex.length) === 0);
            if (unscheduledRequestFound) {
                //log(CONST.portHeader+' Unscheduled Request Found:', unscheduledRequestFound.category);
            }
            else {
                log(CONST.portHeader + ' Unknown Request:', humanizeBuffer(buffer));
            }
        }
    } else if (buffer[4] == 0x02) {
        var cmdFound = CONST.DEVICE_COMMAND.find(obj => buffer.length + 1 === obj.commandHex.length && obj.commandHex.includes(buffer));
        if (cmdFound) {
            //log(CONST.portHeader+' Command Found:', CONST.DEVICE_CONFIG[cmdFound.base_topic].name, '->', cmdFound.state, buffer.toString('hex', 0, 7), buffer.toString('hex', 7));
            updateStatus(cmdFound);
        }
        else {
            log(CONST.portHeader + ' Unknown Command:', humanizeBuffer(buffer));
        }
    }
    else if (buffer[4] == 0x04) {
        var stateFound = CONST.DEVICE_STATE.filter(obj => obj.checkState(obj, buffer));
        if (stateFound.length !== 0) {
            stateFound.forEach(function (obj) {
                // log(CONST.portHeader + ' State Found:', obj.base_topic, obj.stateName, obj.state);
                updateStatus(obj);
            });
        }
        else {
            var ackFound = CONST.DEVICE_COMMAND.find(obj => buffer.length >= obj.ackHex.length && obj.ackHex.compare(buffer, 0, obj.ackHex.length) === 0);
            if (ackFound) {
                var queueFoundIdx = cmdQueue.findIndex(obj => obj.commandHex && ackFound.commandHex.length === obj.commandHex.length && obj.commandHex.compare(ackFound.commandHex) === 0);
                if (queueFoundIdx > -1) {
                    log(CONST.portHeader + ' Success Command:', CONST.DEVICE_CONFIG[ackFound.base_topic].name, '->', ackFound.state, buffer.toString('hex', 0, 7), buffer.toString('hex', 7));
                    cmdQueue.splice(queueFoundIdx, 1);
                }
            }
            else {
                log(CONST.portHeader + ' Unknown Response:', humanizeBuffer(buffer));
            }
        }
		
        // 주기적으로 회신 항목이면 호출시간(Now), 전송가능한시간(miliseconds) 기록해둔다
		var beforeIdleFound = CONST.DEVICE_BEFORE_IDLE.find(obj => buffer.length >= obj.statePrefixHex.length && obj.statePrefixHex.compare(buffer, 0, obj.statePrefixHex.length) === 0);
        if (beforeIdleFound) {
            lastIdleBegin = lastActivity;
			lastActivity = lastActivity - CONST.sendDelay; // idle이 확보되어 있으므로 즉시 호출 가능하도록 조정
			commandProc();
            //log(CONST.portHeader + ' Idle Message Found:', beforeIdleFound.category);			
        }		
    }
    else {
        log(CONST.portHeader + ' Unknown Frame:', humanizeBuffer(buffer));
    }
});


// MQTT 수신
client.on('message', (topic, message) => {
    if (mqttReady) {
        var topics = topic.split('/');
        var value = message.toString(); // message is Buffer
        var objFound = null;
        if (topics[0] === CONST.TOPIC_PREFIX) {
            objFound = CONST.DEVICE_COMMAND.find(obj => topics[1] + '/' + topics[2] + '/' + topics[3] === obj.base_topic && topics[4] === obj.stateName && obj.state === value);
        }

        if (!objFound) {
            log('[MQTT] Receive Unknown Msg.: ', topic, ':', value);
            return;
        }

        if (value === homeStatus[objFound.base_topic + objFound.stateName]) {
            log('[MQTT] Receive & Skip: ', topic, ':', value);
        }
        // Serial메시지 제어명령 전송 & MQTT로 상태정보 전송
        else {
            log('[MQTT] Receive from HA:', topic, ':', value);
            // 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 sendDelay만큼 이전으로 설정
            //objFound.sentTime = (new Date().getTime())-CONST.sendDelay;
            objFound.sentCount = 0;
            cmdQueue.push(objFound);   // 실행 큐에 저장
            updateStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
        }
    }
});


//////////////////////////////////
// 상태값 업데이트 (MQTT로 전송)
//////////////////////////////////
var updateStatus = obj => {
    //log('[MQTT] Update:', obj.base_topic, obj.stateName);
    // 상태값이 없거나 상태가 같으면 반영 중지
    var curStatus = homeStatus[obj.base_topic + obj.stateName];
    if (!obj.state || obj.state === curStatus) return;
    // 미리 상태 반영한 device의 상태 원복 방지

    if (cmdQueue.length > 0) {
        var found = cmdQueue.find(q => q.base_topic === obj.base_topic && q.state === curStatus);
        if (found) {
            log('[MQTT] Drop Old Value: ', obj.base_topic, ':', obj.state);
			log('[LOG] Command Queue Size :', cmdQueue.length, ', Check Queue Size :', chkQueue.length);
            return;
        }
    }
    // 상태 반영 (MQTT publish)
    homeStatus[obj.base_topic + obj.stateName] = obj.state;
    var topic = util.format(CONST.STATE_TOPIC, obj.base_topic, obj.stateName);
    client.publish(topic, obj.state, { retain: true });
    log('[MQTT] Send to HA:', topic, '->', obj.state);

};


//////////////////////////////////
// 수신명령 처리 (MQTT에서 수신)
//////////////////////////////////


const commandProc = () => {
	curTime = new Date().getTime();
    // 기존 홈넷 RS485 메시지와 충돌하지 않도록 Delay를 줌
    var delay = curTime - lastActivity;
    if (delay < CONST.sendDelay) return;

    // idle message 이후 정해진 시간동안만
	var afterIdle = curTime - lastIdleBegin;
    if (afterIdle > CONST.idleDuration) {
        //log(CONST.portHeader, afterIdle, 'ms passed after idling (safe duration ', CONST.idleDuration,'ms )' );
        return;
    }
	
    // 큐에서 제어 메시지 가져오기
	var obj;
    if (cmdQueue.length > 0) { 
		obj = cmdQueue.shift();
	}
	else if (chkQueue.length > 0) {
		obj = chkQueue.shift();
	}
	else {
        //log(CONST.portHeader, 'No command to proceed' );
		return;
	}
	
    if (obj.commandHex) {		
		rs485port.write(obj.commandHex, (err) => { if (err) return log(CONST.portHeader + ' Send Error: ', err.message); });
        lastActivity = new Date().getTime();
        //obj.sentTime = lastActivity; // 명령 전송시간 sentTime으로 저장
        obj.sentCount++;
        log(CONST.portHeader + ' Send to Device:', obj.base_topic, '->', obj.state, '(' + delay + 'ms) ', obj.commandHex.toString('hex', 0, 7), obj.commandHex.toString('hex', 7));

        // 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행
        if (obj.sentCount <= CONST.COMMAND_MAX_RETRY_COUNT) {
            cmdQueue.push(obj);
        }
        else {
            log(CONST.portHeader + ' Fail command:', obj.commandHex.toString('hex', 0, 7), obj.commandHex.toString('hex', 7));
        }
	}
	else if (obj.requestHex) {
		rs485port.write(obj.requestHex, (err) => { if (err) return log(CONST.portHeader + ' Send Error: ', err.message); });
        lastActivity = new Date().getTime();
        obj.lastDelegateActivity = lastActivity;
        //log(CONST.portHeader+' Delegate Scheduled Request:', obj.category, '('+delay+'ms)', obj.requestHex.toString('hex', 0, 7), obj.requestHex.toString('hex', 7) );
	}
    else {
        log('[Queue] Unknown Object:', obj.toString());
    }
};	


const checkWallpadActivity = () => {
    var currentTime = new Date().getTime();
    var timeoutFound = CONST.DEVICE_SCHEDULED_REQUEST.filter(obj => (currentTime - obj.lastActivity) > (CONST.sendDelay * 100));
    if (timeoutFound.length !== 0 && chkQueue.length < CONST.DEVICE_SCHEDULED_REQUEST.length) {
        var delegateTimeoutFound = timeoutFound.filter(obj => (currentTime - obj.lastDelegateActivity) > (CONST.sendDelay * 50));
        if (delegateTimeoutFound.length !== 0) {
            if (CONST.DEVICE_SCHEDULED_REQUEST.reduce((a, b) => a && (b.lastDelegateActivity - b.lastActivity) > (CONST.sendDelay * 1000), true)) updateStatus(CONST.DEVICE_SCHEDULED_REQUEST_ABNORMAL);
            //delegateTimeoutFound.forEach(obj => log('[Serial] Scheduled Request Timeout:', obj.category, '('+(currentTime - obj.lastActivity)+'ms)' ) );
            delegateTimeoutFound.forEach(obj => chkQueue.push(obj));
        }
    } else {
        updateStatus(CONST.DEVICE_SCHEDULED_REQUEST_NORMAL);
    }
};


setTimeout(() => { mqttReady = true; log('[MQTT] Ready...') }, CONST.mqttDelay);
setInterval(commandProc, 20);
setInterval(checkWallpadActivity, CONST.sendDelay * 10);
