import type { HID } from "node-hid";
import { InputId } from "../id";
import { ByteArray } from "./byte_array";

export * from "../id";

/** Maps a HID input of 0...n to -1...1 */
export function mapAxis(value: number, max: number = 255): number {
  return (2 / max) * Math.max(0, Math.min(max, value)) - 1;
}

/** Maps a HID input of 0...255 to 0...1 */
export function mapTrigger(value: number): number {
  return (1 / 255) * Math.max(0, Math.min(255, value));
}

/**
 * Maps a HID input for either gyroscope or acceleration.
 * Adapted from https://github.com/nondebug/dualsense
 */
export function mapGyroAccel(v0: number, v1: number): number {
  let v = (v1 << 8) | v0;
  if (v > 0x7fff) v -= 0x10000;
  return v;
}

/** Describes an observation of the input state of a Dualsense controller */
export interface DualsenseHIDState {
  [InputId.LeftAnalogX]: number;
  [InputId.LeftAnalogY]: number;
  [InputId.RightAnalogX]: number;
  [InputId.RightAnalogY]: number;
  [InputId.LeftTrigger]: number;
  [InputId.RightTrigger]: number;
  [InputId.Triangle]: boolean;
  [InputId.Circle]: boolean;
  [InputId.Cross]: boolean;
  [InputId.Square]: boolean;
  [InputId.Dpad]: number;
  [InputId.Up]: boolean;
  [InputId.Down]: boolean;
  [InputId.Left]: boolean;
  [InputId.Right]: boolean;
  [InputId.RightAnalogButton]: boolean;
  [InputId.LeftAnalogButton]: boolean;
  [InputId.Options]: boolean;
  [InputId.Create]: boolean;
  [InputId.RightTriggerButton]: boolean;
  [InputId.LeftTriggerButton]: boolean;
  [InputId.RightBumper]: boolean;
  [InputId.LeftBumper]: boolean;
  [InputId.Playstation]: boolean;
  [InputId.TouchButton]: boolean;
  [InputId.Mute]: boolean;
  [InputId.Status]: boolean;
  [InputId.TouchX0]: number;
  [InputId.TouchY0]: number;
  [InputId.TouchContact0]: boolean;
  [InputId.TouchId0]: number;
  [InputId.TouchX1]: number;
  [InputId.TouchY1]: number;
  [InputId.TouchContact1]: boolean;
  [InputId.TouchId1]: number;
  [InputId.GyroX]: number;
  [InputId.GyroY]: number;
  [InputId.GyroZ]: number;
  [InputId.AccelX]: number;
  [InputId.AccelY]: number;
  [InputId.AccelZ]: number;
}

/** Supports a connection to a physical or virtual Dualsense device */
export abstract class HIDProvider {
  /** HID vendorId for a Dualsense controller */
  static readonly vendorId: number = 1356;
  /** HID productId for a Dualsense controller */
  static readonly productId: number = 3302;
  /**
   * Expected report sizes, not including the report ID byte.
   * Taken from https://github.com/nondebug/dualsense
   */
  static readonly DUAL_SENSE_USB_INPUT_REPORT_0x01_SIZE: number = 63;
  static readonly DUAL_SENSE_BT_INPUT_REPORT_0x01_SIZE: number = 9;
  static readonly DUAL_SENSE_BT_INPUT_REPORT_0x31_SIZE: number = 77;

  /** Callback to use for new input events */
  public onData: (state: DualsenseHIDState) => void = () => {};

  /** Callback to use for Error events */
  public onError: (error: Error) => void = () => {};

  /** Search for a controller and connect to it */
  abstract connect(): void;

  /** Stop accepting input from the controller */
  abstract disconnect(): void;

  /** Returns true if a device is currently connected and working */
  abstract get connected(): boolean;

  /** The underlying HID device handle */
  abstract device?: HIDDevice | HID;

  /** Returns true if a device is connected wirelessly */
  abstract wireless?: boolean;

  /** Debug: The most recent HID report buffer */
  abstract buffer?: Buffer | DataView;

  /** Converts the HID report to a simpler format */
  abstract process(input: unknown): DualsenseHIDState;

  /** Write to the HID device */
  abstract write(data: Uint8Array): Promise<void>;

  /** True if the device or connection method could not be identified */
  protected unknownDevice: boolean = false;

  /** Debug: Treat the device as if it were connected over Bluetooth */
  public setWireless(): void {
    this.wireless = true;
  }

  /** Debug: Treat the device as if it were connected over USB */
  public setWired(): void {
    this.wireless = false;
  }

  /** Set true to use the outdated HID report format */
  public oldFirmware: boolean = false;

  /**
   * Autodetects the "wireless" parameter based on the length of the buffer.
   * @param bufferLength the length of the buffer
   */
  protected autodetectConnectionType(buffer: ByteArray): void {
    switch (buffer.length) {
      case HIDProvider.DUAL_SENSE_USB_INPUT_REPORT_0x01_SIZE + 1:
        this.wireless = false;
        break;
      case HIDProvider.DUAL_SENSE_BT_INPUT_REPORT_0x31_SIZE + 1:
        this.wireless = true;
        break;
      default:
        if (!this.unknownDevice)
          this.onError(
            new Error(
              `Cannot autodetect connection type, unexpected buffer size: ${buffer.length}`
            )
          );
        this.wireless = undefined;
        this.unknownDevice = true;
    }
  }

  /**
   * Reset the HIDProvider state when the device is disconnected
   */
  protected reset(): void {
    this.device = undefined;
    this.wireless = undefined;
    this.buffer = undefined;
    this.unknownDevice = false;
  }

  /**
   * Process a bluetooth input report of type 01.
   * @param buffer the report
   */
  protected processBluetoothInputReport01(
    buffer: ByteArray
  ): DualsenseHIDState {
    const buttonsAndDpad = buffer.readUint8(7);
    const buttons = buttonsAndDpad >> 4;
    const dpad = buttonsAndDpad & 0b1111;

    const miscButtons = buffer.readUint8(8);
    const lastButtons = buffer.readUint8(9);

    return {
      [InputId.LeftAnalogX]: mapAxis(buffer.readUint8(1)),
      [InputId.LeftAnalogY]: -mapAxis(buffer.readUint8(2)),
      [InputId.RightAnalogX]: mapAxis(buffer.readUint8(3)),
      [InputId.RightAnalogY]: -mapAxis(buffer.readUint8(4)),
      [InputId.LeftTrigger]: mapTrigger(buffer.readUint8(8)),
      [InputId.RightTrigger]: mapTrigger(buffer.readUint8(9)),
      [InputId.Triangle]: (buttons & 8) > 0,
      [InputId.Circle]: (buttons & 4) > 0,
      [InputId.Cross]: (buttons & 2) > 0,
      [InputId.Square]: (buttons & 1) > 0,
      [InputId.Dpad]: dpad,
      [InputId.Up]: dpad < 2 || dpad === 7,
      [InputId.Down]: dpad > 2 && dpad < 6,
      [InputId.Left]: dpad > 4 && dpad < 8,
      [InputId.Right]: dpad > 0 && dpad < 4,
      [InputId.LeftTriggerButton]: (miscButtons & 4) > 0,
      [InputId.RightTriggerButton]: (miscButtons & 8) > 0,
      [InputId.LeftBumper]: (miscButtons & 1) > 0,
      [InputId.RightBumper]: (miscButtons & 2) > 0,
      [InputId.Create]: (miscButtons & 16) > 0,
      [InputId.Options]: (miscButtons & 32) > 0,
      [InputId.LeftAnalogButton]: (miscButtons & 64) > 0,
      [InputId.RightAnalogButton]: (miscButtons & 128) > 0,
      [InputId.Playstation]: (lastButtons & 1) > 0,
      [InputId.TouchButton]: (lastButtons & 2) > 0,
      [InputId.Mute]: (lastButtons & 4) > 0,
      [InputId.GyroX]: mapGyroAccel(buffer.readUint8(16), buffer.readUint8(17)),
      [InputId.GyroY]: mapGyroAccel(buffer.readUint8(18), buffer.readUint8(19)),
      [InputId.GyroZ]: mapGyroAccel(buffer.readUint8(20), buffer.readUint8(21)),
      [InputId.AccelX]: mapGyroAccel(
        buffer.readUint8(22),
        buffer.readUint8(23)
      ),
      [InputId.AccelY]: mapGyroAccel(
        buffer.readUint8(24),
        buffer.readUint8(25)
      ),
      [InputId.AccelZ]: mapGyroAccel(
        buffer.readUint8(26),
        buffer.readUint8(27)
      ),
      [InputId.TouchId0]: buffer.readUint8(33) & 0x7f,
      [InputId.TouchContact0]: (buffer.readUint8(33) & 0x80) === 0,
      [InputId.TouchX0]: mapAxis((buffer.readUint16LE(34) << 20) >> 20, 1920),
      [InputId.TouchY0]: mapAxis(buffer.readUint16LE(35) >> 4, 1080),
      [InputId.TouchId1]: buffer.readUint8(37) & 0x7f,
      [InputId.TouchContact1]: (buffer.readUint8(37) & 0x80) === 0,
      [InputId.TouchX1]: mapAxis((buffer.readUint16LE(38) << 20) >> 20, 1920),
      [InputId.TouchY1]: mapAxis(buffer.readUint16LE(39) >> 4, 1080),
      [InputId.Status]: (buffer.readUint8(54) & 4) > 0,

      // TODO: See https://github.com/nondebug/dualsense/blob/main/dualsense-explorer.html#L338
      //
      // "By default, bluetooth-connected DualSense only sends input report 0x01 which omits motion and touchpad data.
      //  Reading feature report 0x05 causes it to start sending input report 0x31.
      //
      //  Note: The Gamepad API will do this for us if it enumerates the gamepad.
      //  Other applications like Steam may have also done this already."
    };
  }

  /**
   * Process reports generated by an older Dualsense firmware
   */
  protected processOldInputReport(buffer: ByteArray) {
    const offset = this.wireless ? 0 : 1;
    const buttonsAndDpad = buffer.readUint8(9 - offset);
    const buttons = buttonsAndDpad >> 4;
    const dpad = buttonsAndDpad & 0b1111;
    const miscButtons = buffer.readUint8(10 - offset);
    const lastButtons = buffer.readUint8(11 - offset);

    return {
      [InputId.LeftAnalogX]: mapAxis(buffer.readUint8(2 - offset)),
      [InputId.LeftAnalogY]: -mapAxis(buffer.readUint8(3 - offset)),
      [InputId.RightAnalogX]: mapAxis(buffer.readUint8(4 - offset)),
      [InputId.RightAnalogY]: -mapAxis(buffer.readUint8(5 - offset)),
      [InputId.LeftTrigger]: mapTrigger(buffer.readUint8(6 - offset)),
      [InputId.RightTrigger]: mapTrigger(buffer.readUint8(7 - offset)),
      [InputId.Triangle]: (buttons & 8) > 0,
      [InputId.Circle]: (buttons & 4) > 0,
      [InputId.Cross]: (buttons & 2) > 0,
      [InputId.Square]: (buttons & 1) > 0,
      [InputId.Dpad]: dpad,
      [InputId.Up]: dpad < 2 || dpad === 7,
      [InputId.Down]: dpad > 2 && dpad < 6,
      [InputId.Left]: dpad > 4 && dpad < 8,
      [InputId.Right]: dpad > 0 && dpad < 4,
      [InputId.LeftTriggerButton]: (miscButtons & 4) > 0,
      [InputId.RightTriggerButton]: (miscButtons & 8) > 0,
      [InputId.LeftBumper]: (miscButtons & 1) > 0,
      [InputId.RightBumper]: (miscButtons & 2) > 0,
      [InputId.Create]: (miscButtons & 16) > 0,
      [InputId.Options]: (miscButtons & 32) > 0,
      [InputId.LeftAnalogButton]: (miscButtons & 64) > 0,
      [InputId.RightAnalogButton]: (miscButtons & 128) > 0,
      [InputId.Playstation]: (lastButtons & 1) > 0,
      [InputId.TouchButton]: (lastButtons & 2) > 0,
      [InputId.Mute]: (lastButtons & 4) > 0,
      [InputId.GyroX]: buffer.readUint16LE(17 - offset),
      [InputId.GyroY]: buffer.readUint16LE(19 - offset),
      [InputId.GyroZ]: buffer.readUint16LE(21 - offset),
      [InputId.AccelX]: buffer.readUint16LE(23 - offset),
      [InputId.AccelY]: buffer.readUint16LE(25 - offset),
      [InputId.AccelZ]: buffer.readUint16LE(27 - offset),
      [InputId.TouchId0]: buffer.readUint8(34 - offset) & 0x7f,
      [InputId.TouchContact0]: (buffer.readUint8(34 - offset) & 0x80) === 0,
      [InputId.TouchX0]: mapAxis(
        (buffer.readUint16LE(35 - offset) << 20) >> 20,
        1920
      ),
      [InputId.TouchY0]: mapAxis(buffer.readUint16LE(36 - offset) >> 4, 1080),
      [InputId.TouchId1]: buffer.readUint8(38 - offset) & 0x7f,
      [InputId.TouchContact1]: (buffer.readUint8(38 - offset) & 0x80) === 0,
      [InputId.TouchX1]: mapAxis(
        (buffer.readUint16LE(39 - offset) << 20) >> 20,
        1920
      ),
      [InputId.TouchY1]: mapAxis(buffer.readUint16LE(40 - offset) >> 4, 1080),
      [InputId.Status]: (buffer.readUint8(55 - offset) & 4) > 0,
    };
  }

  /**
   * Process a USB input report of type 01.
   * @param buffer the report
   */
  protected processUsbInputReport01(buffer: ByteArray): DualsenseHIDState {
    const buttonsAndDpad = buffer.readUint8(8);
    const buttons = buttonsAndDpad >> 4;
    const dpad = buttonsAndDpad & 0b1111;
    const miscButtons = buffer.readUint8(9);
    const lastButtons = buffer.readUint8(10);

    return {
      [InputId.LeftAnalogX]: mapAxis(buffer.readUint8(1)),
      [InputId.LeftAnalogY]: -mapAxis(buffer.readUint8(2)),
      [InputId.RightAnalogX]: mapAxis(buffer.readUint8(3)),
      [InputId.RightAnalogY]: -mapAxis(buffer.readUint8(4)),
      [InputId.LeftTrigger]: mapTrigger(buffer.readUint8(5)),
      [InputId.RightTrigger]: mapTrigger(buffer.readUint8(6)),
      [InputId.Triangle]: (buttons & 8) > 0,
      [InputId.Circle]: (buttons & 4) > 0,
      [InputId.Cross]: (buttons & 2) > 0,
      [InputId.Square]: (buttons & 1) > 0,
      [InputId.Dpad]: dpad,
      [InputId.Up]: dpad < 2 || dpad === 7,
      [InputId.Down]: dpad > 2 && dpad < 6,
      [InputId.Left]: dpad > 4 && dpad < 8,
      [InputId.Right]: dpad > 0 && dpad < 4,
      [InputId.LeftTriggerButton]: (miscButtons & 4) > 0,
      [InputId.RightTriggerButton]: (miscButtons & 8) > 0,
      [InputId.LeftBumper]: (miscButtons & 1) > 0,
      [InputId.RightBumper]: (miscButtons & 2) > 0,
      [InputId.Create]: (miscButtons & 16) > 0,
      [InputId.Options]: (miscButtons & 32) > 0,
      [InputId.LeftAnalogButton]: (miscButtons & 64) > 0,
      [InputId.RightAnalogButton]: (miscButtons & 128) > 0,
      [InputId.Playstation]: (lastButtons & 1) > 0,
      [InputId.TouchButton]: (lastButtons & 2) > 0,
      [InputId.Mute]: (lastButtons & 4) > 0,
      // The other 5 bits are unused
      // 5 reserved bytes
      [InputId.GyroX]: mapGyroAccel(buffer.readUint8(16), buffer.readUint8(17)),
      [InputId.GyroY]: mapGyroAccel(buffer.readUint8(18), buffer.readUint8(19)),
      [InputId.GyroZ]: mapGyroAccel(buffer.readUint8(20), buffer.readUint8(21)),
      [InputId.AccelX]: mapGyroAccel(
        buffer.readUint8(22),
        buffer.readUint8(23)
      ),
      [InputId.AccelY]: mapGyroAccel(
        buffer.readUint8(24),
        buffer.readUint8(25)
      ),
      [InputId.AccelZ]: mapGyroAccel(
        buffer.readUint8(26),
        buffer.readUint8(27)
      ),
      // 4 bytes for sensor timestamp (32LE)
      // 1 reserved byte
      [InputId.TouchId0]: buffer.readUint8(33) & 0x7f,
      [InputId.TouchContact0]: (buffer.readUint8(33) & 0x80) === 0,
      [InputId.TouchX0]: mapAxis((buffer.readUint16LE(34) << 20) >> 20, 1920),
      [InputId.TouchY0]: mapAxis(buffer.readUint16LE(35) >> 4, 1080),
      [InputId.TouchId1]: buffer.readUint8(37) & 0x7f,
      [InputId.TouchContact1]: (buffer.readUint8(37) & 0x80) === 0,
      [InputId.TouchX1]: mapAxis((buffer.readUint16LE(38) << 20) >> 20, 1920),
      [InputId.TouchY1]: mapAxis(buffer.readUint16LE(39) >> 4, 1080),
      // 12 reserved bytes
      [InputId.Status]: (buffer.readUint8(54) & 4) > 0,
    };
  }
}
