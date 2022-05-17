import { HTTPResponse } from "#http/response";
import { createRoute } from "#http/route";
import type { ExampleService } from "#services/example.service";
import { z } from 'zod';

export default createRoute({
  body: z.object({
    username: z.string(),
    password: z.string()
  }),

  handler(req, exampleService: ExampleService) {
    return HTTPResponse.ok(exampleService.sayHi(), 203).setCookie('HELLO', 'You', { httpOnly: true, expires: new Date(Date.now() + 1000 * 60) });
  }
});