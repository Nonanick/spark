export function queryParamsParser(url : string) {

  const parsed = new URLSearchParams(url);
  let response = Object.create(null);
  for (let [k, v] of parsed.entries()) {
    // avoid proto polluting
    if (k !== '__proto__') {
      response[k] = v;
    }
  }

  return response;
}