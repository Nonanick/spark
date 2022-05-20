import { setupRouteTest } from '#test/mock/setup_route';
import { asValue } from 'awilix';
import { beforeAll, expect, test } from 'vitest';

let routeTestingTools: Awaited<ReturnType<typeof setupRouteTest>>;

beforeAll(async () => {
  routeTestingTools = await setupRouteTest(
    import.meta.url,
    {
      register: {
        authenticationService: asValue({
          checkAccessToken: (token: string) => {
            return token === 'OK_YOU_ARE_LOGGED_IN_TEST';
          }
        })
      }
    }
  );
});

test('route prevents access from non authorized requests with "Bad Request"', async () => {
  const res = await routeTestingTools.httpClient('private');
  expect(res.status).toBe(400);
});

test('route prevents access from incorrect token with "Unauthorized"', async () => {
  const res = await routeTestingTools.httpClient('private', {
    headers: {
      'Cookie': 'ACCESS_TOKEN=INCORRECT_TOKEN',
    }
  });
  expect(res.status).toBe(401);

});

test('route allows access from authorized requests', async () => {
  const res = await routeTestingTools.httpClient('private', {
    headers: {
      'Cookie': 'ACCESS_TOKEN=OK_YOU_ARE_LOGGED_IN_TEST'
    },
  });
  expect(res.status).toBe(200);

});

test('payload is of expected type', async () => {
  const res = await routeTestingTools.httpClient('private', {
    headers: {
      'Cookie': 'ACCESS_TOKEN=OK_YOU_ARE_LOGGED_IN_TEST',
    }
  });
  expect(res.status).toBe(200);
  await expect(res.text()).resolves.toBe("hello from private!");
})