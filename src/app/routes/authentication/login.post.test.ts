import { setupRouteTest } from "#test/mock/setup_route";
import { beforeAll } from "vitest";

beforeAll(async () => {

  const routeTest = setupRouteTest(
    import.meta.url,
    {
    }
  );

});