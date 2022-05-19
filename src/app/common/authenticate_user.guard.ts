import { createGuard } from "#http/route_guard";
import { z } from "zod";

export default createGuard({
  name: 'Authenticate user',
  headers: {
    'x-authentication': z.string()
  },
  guard(req) {
    if (req.headers['x-authentication'] != 'authenticated') {
      return false;
    }

    req.provide("user", { name: "admin", privileges: "admin" });
    return true;
  }
})

export interface IAuthenticatedUser {
  name : string;
  privileges : string | string;
}