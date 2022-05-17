import { createContainer, InjectionMode } from "awilix";

const container = createContainer({
  injectionMode : InjectionMode.CLASSIC
});

export { container };