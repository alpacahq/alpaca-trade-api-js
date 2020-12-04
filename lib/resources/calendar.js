"use strict";

import { omitBy, isNil } from "lodash";
import { toDateString } from "../utils/dateformat";

function get({ start, end } = {}) {
  const queryParams = omitBy(
    {
      start: toDateString(start),
      end: toDateString(end),
    },
    isNil
  );
  return this.httpRequest("/calendar", queryParams);
}

export default { get };
