"use stricts";
// certain endpoints don't accept ISO dates,
// so to allow the user to use regular JS date objects
// with the api, we need to convert them to strings
export function toDateString(date) {
  if (date == null || typeof date === "string") return date;
  const numPad = (num) => (num < 10 ? "0" + num : num);
  return [date.getUTCFullYear(), numPad(date.getUTCMonth() + 1), numPad(date.getUTCDate())].join('-');
}

export default { toDateString };
