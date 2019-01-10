const rpio = require('rpio');

let Service, Characteristic;

// "accessories": [
//   {
//     "accessory": "HomebridgeSomfy",
//     "name": "display-name",
//     "pinup": "3",
//     "pindown": "5",
//     "duration: 10"
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
    this.movementDuration = config['duration'];

    this.log('Average movement duration is ' + this.movementDuration + ' seconds');

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

        clearInterval(me.interval);
        me.targetPosition = position !== 0 && position !== 100 ? 0 : position;

        if (me.targetPosition === 100) {
            me.log('Opening shutters');

            rpio.write(me.PIN_UP, rpio.LOW);
            rpio.msleep(100);
            rpio.write(me.PIN_UP, rpio.HIGH);

            me.positionState = Characteristic.PositionState.DECREASING;
        } else {
            me.log('Closing shutters');

            rpio.write(me.PIN_DOWN, rpio.LOW);
            rpio.msleep(100);
            rpio.write(me.PIN_DOWN, rpio.HIGH);

            me.positionState = Characteristic.PositionState.INCREASING;
        }

        me.interval = setInterval(() => {
            if (me.currentPosition !== me.targetPosition) {
                if (me.targetPosition === 100) {
                    me.currentPosition += 10;
                } else if (me.targetPosition === 0){
                    me.currentPosition -= 10;
                }
                me.service.setCharacteristic(Characteristic.CurrentPosition, me.currentPosition);
            } else {
                me.log('Operation completed!');

                me.positionState = Characteristic.PositionState.STOPPED;
                me.service.setCharacteristic(Characteristic.PositionState, me.positionState);
                clearInterval(me.interval);
            }

        }, me.movementDuration * 100);

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