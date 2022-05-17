import { DependencyName } from "#container/symbols";

export class ExampleService {
  // to "reference" this service in any "create" or intercept function just name the parameter "example"!
  static [DependencyName] = 'exampleService';

  sayHi(name : string = '') {
    return `hello ${name}`;
  }
}