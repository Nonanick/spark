import { createRoute } from "#http/route";
import type { ExampleService } from "#services/example.service";
import { z } from "zod";

export default createRoute({
  handler(_req, exampleService : ExampleService) {
    return exampleService.sayHi();
  }
});

export const namedHello = createRoute({
  url : ':name',
  urlParams : {
    name : z.string()
  },
  handler(req, exampleService : ExampleService) {
    return exampleService.sayHi(req.urlParams.name);
  }
})