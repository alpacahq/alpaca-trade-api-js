"use strict";

function get() {
  return this.httpRequest("/clock");
}

export default { get };
