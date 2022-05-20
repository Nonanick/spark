import { setupRouteTest } from "#test/mock/setup_route";
import { beforeAll } from "vitest";

const routeTest = await setupRouteTest(
  import.meta.url,
  {}
);

beforeAll(async () => {

  const routeTest = await setupRouteTest(
    import.meta.url,
    {}
  );

});