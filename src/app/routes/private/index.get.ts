import { createRoute } from "#http/route";

export default createRoute({
  handler() {
    return  'hello from private!';
  }
});