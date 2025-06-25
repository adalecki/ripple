if (typeof File !== 'undefined') {
  Object.defineProperty(File.prototype, 'arrayBuffer', {
    value: function() {
      return Promise.resolve(new ArrayBuffer(0));
    }
  });
}