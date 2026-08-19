// jsdom does not expose structuredClone, which Plate/Pattern/Well clone() rely on
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

// jsdom has no ResizeObserver; PlateViewCanvas observes its grid container to redraw
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
  };
}

if (typeof File !== 'undefined') {
  Object.defineProperty(File.prototype, 'arrayBuffer', {
    value: function() {
      return Promise.resolve(new ArrayBuffer(0));
    }
  });
}