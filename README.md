# dualsense-ts

Under construction - come back later

## What doesn't work

- Headphone jack
- Speaker
- Touchpad
- Multiple devices probably

## Getting started

### Setting up

#### Connect to a device

By default, `dualsense-ts` will try to connect to the first Dualsense controller it finds.

```Typescript
import { Dualsense } from 'dualsense-ts';

// Grab a controller connected via USB or Bluetooth
const controller = new Dualsense();
```

### Getting input

Interface with your controller using your preferred pattern - `dualsense-ts` supports
synchronous state checks, plus callbacks, promises, and async iterators.

#### Synchronously check the current state

It's safe to read the current state of the `controller` at any time.

```typescript
// Buttons
controller.circle.active; // false
controller.cross.active; // true
controller.left.bumper.active; // true

// Triggers
controller.right.trigger.active; // true
controller.right.trigger.pressure; // 0.72 (0 - 1)

// Analog Sticks
controller.left.analog.x; // 0.50 (0 - 1)
controller.left.analog.y; // 0.11 (0 - 1)
```

#### Get callbacks when inputs change

Register callbacks that run when an input changes. Use the `Subscription` token to manage them.

```typescript
const subscription = controller.triangle.subscribe((input) =>
  console.log(`${input} changed: ${input.active}`)
);
// # ▲ [X] changed: true
// # ▲ [_] changed: false

// Cancel the subscription at any time
subscription.cancel();
// alternatively,
controller.triangle.unsubscribe(subscription);
```

#### Await one-off inputs

Wait for confirmation or handle other one-off workflows by awaiting the next
state change on any input.

```typescript
// Wait for the next press or release of d-pad up
const { active } = await controller.dpad.up.next();

// The dpad itself is an input that hosts the four directional buttons
// Wait for the next input from any d-pad button
const { left, up, down, right } = await controller.dpad.next();

// Wait for the user to do anything
await controller.next();
```

#### Wait for input using async iterators

Each controller input is an async iterator that continuously provides values as states change.

```typescript
for (const { left, right, up, down } of await controller.dpad) {
  console.log(`dpad: ${left} ${up} ${down} ${right}`);
  // You'll need to break the loop manually
}
```

#### Use event listeners

Coming soon

```typescript
// TODO
```

#### Use streams

Coming soon

```typescript
// TODO
```

### Other Dualsense features

#### Provide haptic feedback (coming soon)

```typescript
// Control haptic rumble
controller.left.haptic.intensity; // 0 (0 - 1)
controller.left.haptic.set(0.7); // left side begins to rumble modestly
controller.left.haptic.intensity; // 0.7

// Stop haptic feedback when you're ready
setTimeout(controller.left.haptic.stop, 40); // left side stops rumbling after 40 milliseconds

// Or provide a duration in milliseconds
controller.right.haptic.set(1.0, 40); // right side rumbles strongly for 40 milliseconds
controller.right.haptic.stop(40); // right side stops rumbling after 40 milliseconds

// The trigger has its own haptics
// Continuously increase rumble as the trigger is pulled
controller.right.trigger.subscribe(({ haptic, pressure }) =>
  haptic.set(pressure)
);
```

#### Set LED indicators (coming soon)

```typescript
// You can set individual color channels on the main indicator
controller.indicator.red(0.5);
controller.indicator.green(0.2);
controller.indicator.blue(0.7);

// Or...
controller.indicator.color([0.5, 0.2, 0.7]);

// Durations apply here as well
controller.indicator.red(0.7, 65); // Red for 65 milliseconds
controller.indicator.color([0.2, 0.1, 0.4], 100); // Lavender for 100 milliseconds

// Toggle a simple indicator
controller.mute.indicator.enable(25); // Turn on the mute LED for 25 milliseconds
controller.mute.indicator.disable(); // Turn off the mute LED immediately
controller.mute.indicator.toggle(true, 20); // Turn on the mute LED for 20 milliseconds
```

### Other `dualsense-ts` features

#### Managing multiple controllers

- Wait for new devices
- Reconnect automatically when a device is lost
- Devices are fingerprinted to ensure reconnection is consistent

_Coming soon_

#### Virtual inputs

`dualsense-ts` provides some "virtual" inputs for convenience. They work exactly
the same as the native ones.

```typescript
// The device provides X and Y magnitudes for each analog stick
for (await const { x, y } of controller.left.analog) {
  console.log(`Left analog: ${x}, ${y}`)
}
// # Left analog: X: 0.5, Y: 0.5

// `dualsense-ts` provides some virtual inputs based on the analog's `x` and `y`
for (await const { direction, magnitude } of controller.left.analog) {
  console.log(`Left analog: ${direction}, ${magnitude}`)
}
// # Left analog: Direction (rad): 1.2, Magnitude: 0.74332

// Where applicable, you can get values in the units you prefer
const { radians, degrees } = await controller.left.analog.direction.next()
console.log(radians, degrees)
// # Direction (deg): 68.75 Direction (rad): 1.19`
```

#### Indicator & haptics scripting

More tools for providing nuanced, multi-dimensional feedback to the user.

_Coming someday_

#### Input smoothing

Use virtual inputs to get debounced or time-averaged values.

_Coming someday_

#### Input contexts

Create and manage input contexts on the controller to filter subscriptions and awaitables.

_Coming someday_

#### Idle sensing

Use the gyroscope and accelerometer to check whether the controller is resting on a surface
or if all inputs have been idle for some time.

_Coming someday_

#### Input recording & replay

Capture an input log, and replay the inputs for testing or other automation purposes.

_Coming someday_

## Credits

- [CamTosh](https://github.com/CamTosh)'s [node-dualsense](https://github.com/CamTosh/node-dualsense)
- [flok](https://github.com/flok)'s [pydualsense](https://github.com/flok/pydualsense)
