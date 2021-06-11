# Homebridge Somfy Remote

This Homebridge plugin allows control of Raspberry Pi GPIO pins, more specifically to control a Somfy remote + schematics to wire the remote to the Raspberry Pi.

To install this plugin simple type `sudo npm install homebridge-somfy -g --unsafe-perm=true`.
Next open the config.json that contains your Homebridge configuration and add a block like the following one to the accessories array:

```json
{
    "accessory": "HomebridgeSomfy",
    "name": "display-name",
    "pinup": "hardware pin number",
    "pindown": "hardware pin number",
    "movementduration": "average full up/down motion in seconds",
    "pressduration": "duration of button press in milliseconds",
    "delay": "the delay in seconds (can be 0 for the first plugin instance)", 
    "mqttbroker": "mqtt://broker-url:1883",
    "mqttuser": "username",
    "mqttpassword": "password",
    "mqtttopicin": "/path/and/topic/in",
    "mqtttopicout": "/path/and/topic/out"
}
```

The accessory name has to be `HomebridgeSomfy` to link to the plugin.
The `name` field is for the display name in the HomeKit app.
The `pinup` and `pindown` fields are your hardware pin numbers for shutters up/down.
The `movementduration` field sets the duration (in seconds as a string) it takes for the shutters to fully open or close.
The `pressduration` field sets the duration (in milliseconds as a string) the button on the remote is activated/pressed.
The `delay` field is optional when only one instance of this plugin is used.
The `mqttbroker` field is the broker url (including mqtt:// and port, default 1883) to connect to.
The `mqttuser` field is the username used for the mqtt connection.
The `mqttpassword` field is the password used for the mqtt connection.
The `mqtttopicin` field contains the topic for controlling the shutters via mqtt, payload must be JSON with a field name `target` being either `up` or `down`.
The `mqtttopicout` field contains the topic for sending updates when the shutters are controlled, the messages have the retained flag set.
When using multiple instances of this plugin it is required to specify this field. 
It contains the number of seconds that the plugin should wait before sending a signal to the remote. 

The default state for the shutters in the HomeKit app is disabled, which means the shutters are raised.
If the switch is active it means the shutters are lowered.
The plugin only sends a short activation signal and keeps internal state of the shutters.

## Hardware Requirements

- Telis 1/4 RTS remote - Remote control for Somfy systems
    - The Telis 1 remote can be bought for about 30 euros but can only control one channel!
- Raspberry Pi (any version)


## Hardware guide

- Program the remote with your original remote
    - Follow the guide [in the official documentation](https://service.somfy.com/downloads/be_v4/webtelis-1-rts_04.pdf)
    - Look on Page 6, the first section (in Dutch)
- Open the remote and remove the battery
- Remove the last remaining screw (Torx Security, can be removed with tweezers)
- Remove the logic board from the unit (beware no the break the clasps)
- Look at the image below and solder wires to these exact points
<br/>![Logic board with soldered wires](resources/img/remote-wires.jpg?raw=true "Logic board with soldered wires")
    - The Orange wire: VCC
    - The Grey wire: GND
    - The Yellow wire: Signal UP
    - The Purple wire: Signal DOWN
- Make some cutouts in the soft plastic of the side of the remote, this will allow the wires to pass through.
<br/>![Wire cutouts](resources/img/remote-cutout.jpg?raw=true "Wire cutouts")
- Close the remote (leave out the Torx screw)
- Hook up the remote to the Raspberry Pi as seen in the picture.
<br/>![Wire cutouts](resources/img/pi-connection.jpg?raw=true "Wire cutouts")
    - Holding the Pi in the position as shown
    - Pin 1 (Top right): VCC
    - PIN 2: Signal UP (hardware pin: 3, use this number in the config)
    - PIN 3: Signal DOWN (hardware pin 5, use this number in the config)
    - PIN 4: Not connected
    - PIN 5: GND
- Once fully connected, install this package with the command in the beginning of this readme and add the config to the Homebridge config.json file.
- If desired you can use any combination of the available GPIO pins on the Pi, just be sure to enter the correct hardware pin numbers in the config!

This code makes use of the `node-rpio` library, more information [here](https://github.com/jperkin/node-rpio)