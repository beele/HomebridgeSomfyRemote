const rpio = require('rpio');

let Service, Characteristic;

// "accessories": [
//   {
//     "accessory": "HomebridgeSomfy",
//     "name": "display-name",
//     "pinup": "3",
//     "pindown": "5"
//   }
// ]

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-somfy', 'HomebridgeSomfy', HomebridgeSomfy);
};

function HomebridgeSomfy(log, config) {
    this.log = log;
    this.isOn = true;

    this.PIN_UP = config['pinup'];
    this.PIN_DOWN = config['pindown'];

    rpio.open(this.PIN_UP, rpio.OUTPUT, rpio.HIGH);
    rpio.open(this.PIN_DOWN, rpio.OUTPUT, rpio.HIGH);
}

HomebridgeSomfy.prototype = {
    getPowerState: function (next) {
        return next(null, this.isOn);
    },

    setPowerState: function (powerOn, next) {
        const me = this;

        if (powerOn) {
            rpio.write(me.PIN_UP, rpio.LOW);
            rpio.msleep(100);
            rpio.write(me.PIN_UP, rpio.HIGH);

            me.isOn = true;
        } else {
            rpio.write(me.PIN_DOWN, rpio.LOW);
            rpio.msleep(100);
            rpio.write(me.PIN_DOWN, rpio.HIGH);

            me.isOn = false;
        }

        next();
    },

    getServices: function () {
        const me = this;
        const informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Somfy")
            .setCharacteristic(Characteristic.Model, "Telis 1 RTS")
            .setCharacteristic(Characteristic.SerialNumber, "1234-5678");

        const switchService = new Service.Switch(me.name);
        switchService.getCharacteristic(Characteristic.On)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));

        this.informationService = informationService;
        this.switchService = switchService;
        return [informationService, switchService];
    }
};