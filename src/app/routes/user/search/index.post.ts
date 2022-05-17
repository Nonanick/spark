import { createRoute } from "#http/route";
import { z } from "zod";

const SearchSchema = z.object({
  a : z.string(),
  b : z.number()
});
export default createRoute({
  body : SearchSchema,
});