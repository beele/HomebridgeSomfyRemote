const rpio = require('rpio');
const mqtt = require('mqtt');

let Service, Characteristic;

// "accessories": [
//   {
//     "accessory": "HomebridgeSomfy",
//     "name": "display-name",
//     "pinup": "3",
//     "pindown": "5",
//     "movementduration: "10",
//     "pressduration": "250",
//     "delay": "1"
//     "mqttbroker": "mqtt://broker-url:1883",
//     "mqttuser": "username",
//     "mqttpassword": "password",
//     "mqtttopicin": "/path/and/topic/in",
//     "mqtttopicout": "/path/and/topic/out",
//   }
// ]

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-somfy', 'HomebridgeSomfy', HomebridgeSomfy);
};

function HomebridgeSomfy(log, config) {
    this.service = new Service.WindowCovering(this.name);
    this.log = log;

    this.currentPosition = 100;
    this.targetPosition = 100;
    this.positionState = Characteristic.PositionState.STOPPED;

    this.PIN_UP = config['pinup'];
    this.PIN_DOWN = config['pindown'];
    this.movementDuration = config['movementduration'] ? config['movementduration'] : 10;
    this.buttonPressDuration = config['pressduration'] ? config['pressduration'] : 250;
    this.delay = config['delay'] ? ((config['delay'] * 1000) + 1) : 0;
    this.mqttBroker = config['mqttbroker'] ? config['mqttbroker'] : null;
    this.mqttUser = config['mqttuser'] ? config['mqttuser'] : null;
    this.mqttPassword = config['mqttpassword'] ? config['mqttpassword'] : null;
    this.mqttTopicIn = config['mqtttopicin'] ? config['mqtttopicin'] : null;
    this.mqttTopicOut = config['mqtttopicout'] ? config['mqtttopicout'] : null;

    this.log('Average movement duration is ' + this.movementDuration + ' seconds');

    this.up = () => {
        this.positionState = Characteristic.PositionState.DECREASING;
        rpio.write(this.PIN_UP, rpio.LOW);
        rpio.msleep(this.buttonPressDuration);
        rpio.write(this.PIN_UP, rpio.HIGH);
    };
    this.down = () => {
        this.positionState = Characteristic.PositionState.INCREASING;
        rpio.write(this.PIN_DOWN, rpio.LOW);
        rpio.msleep(this.buttonPressDuration);
        rpio.write(this.PIN_DOWN, rpio.HIGH);
    };
    this.sendMqtt = (topic, message) => {
        if (this.client && this.client.connected) {
            this.client.publish(topic, message, {retain: true, qos: 1});
        }
    };

    if (this.mqttBroker) {
        this.client = mqtt.connect(this.mqttBroker, {username: this.mqttUser, password: this.mqttPassword});
        this.client.on('connect', () => {
            this.log('Connected to MQTT broker!');

            this.client.subscribe(this.mqttTopicIn, (err, granted) => {
                if (!err) {
                    if (granted && granted.length === 1) {
                        this.client.on('message', (topic, payload, packet) => {
                            const input = JSON.parse(payload.toString());
                            if (input.target === 'up') {
                                this.log('Opening shutters via mqtt');
                                setTimeout(() => {
                                    this.up();
                                    this.up();
                                });
                                this.sendMqtt(this.mqttTopicOut, JSON.stringify({state: 'up'}));
                            } else if(input.target === 'down') {
                                this.log('Closing shutters via mqtt');
                                setTimeout(() => {
                                    this.down();
                                    this.down();
                                });
                                this.sendMqtt(this.mqttTopicOut, JSON.stringify({state: 'down'}));
                            }
                        });
                    }
                }
            })
        });
    } else {
        this.client = null;
    }

    rpio.open(this.PIN_UP, rpio.OUTPUT, rpio.HIGH);
    rpio.open(this.PIN_DOWN, rpio.OUTPUT, rpio.HIGH);
}

HomebridgeSomfy.prototype = {
    getCurrentPosition: function (callback) {
        const me = this;
        callback(null, me.currentPosition);
    },
    getTargetPosition: function (callback) {
        const me = this;
        callback(null, me.targetPosition);
    },
    setTargetPosition: function (position, callback) {
        const me = this;

        clearInterval(me.delayInterval);
        me.delayInterval = setTimeout(() => {
            clearInterval(me.durationInterval);
            me.targetPosition = position !== 0 && position !== 100 ? 0 : position;

            if (me.targetPosition === 100) {
                me.log('Opening shutters via homekit');
                setTimeout(() => {
                    me.up();
                    me.up();
                });
                me.sendMqtt(me.mqttTopicOut, JSON.stringify({state: 'up'}));
            } else {
                me.log('Closing shutters via homekit');
                setTimeout(() => {
                    me.down();
                    me.down();
                });
                me.sendMqtt(me.mqttTopicOut, JSON.stringify({state: 'down'}));
            }

            me.durationInterval = setTimeout(() => {
                me.currentPosition = me.targetPosition === 100 ? 100 : 0;

                me.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(me.currentPosition);
                me.positionState = Characteristic.PositionState.STOPPED;
                me.service.getCharacteristic(Characteristic.PositionState).updateValue(me.positionState);

                me.log('Operation completed!');
            }, me.movementDuration * 1000);
        }, me.delay);

        callback(null);
    },
    getPositionState: function (callback) {
        const me = this;
        callback(null, me.positionState);
    },

    getServices: function () {
        const me = this;
        const informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Somfy")
            .setCharacteristic(Characteristic.Model, "Telis 1 RTS")
            .setCharacteristic(Characteristic.SerialNumber, "1234-5678");

        const currentPositionChar = this.service.getCharacteristic(Characteristic.CurrentPosition);
        currentPositionChar.on('get', this.getCurrentPosition.bind(this));

        const targetPositionChar = this.service.getCharacteristic(Characteristic.TargetPosition);
        targetPositionChar.setProps({
            format: Characteristic.Formats.UINT8,
            unit: Characteristic.Units.PERCENTAGE,
            maxValue: 100,
            minValue: 0,
            minStep: 100,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        targetPositionChar.on('get', this.getTargetPosition.bind(this));
        targetPositionChar.on('set', this.setTargetPosition.bind(this));

        this.service.getCharacteristic(Characteristic.PositionState)
            .on('get', this.getPositionState.bind(this));

        return [informationService, me.service];
    }
};