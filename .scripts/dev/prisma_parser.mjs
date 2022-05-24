// @ts-check
const isModelDeclaration = /^model (?<name>.+?)\{/;
const isEnumDeclaration = /^enum (?<name>.+?)\{/;
const isTypeDeclaration = /^type (?<name>.+?)\{/;
const isEndOfDeclaration = /^\}$/;

export class PrismaFileParser {

  fileContent = '';

  models = {};

  enums = {};

  types = {};

  constructor(content) {
    this.fileContent = content;
  }

  parse() {

    let currentContext = undefined;
    const pieces = this.fileContent.split('\n');

    for (let line of pieces) {
      line = line.trim();
      if (line.length === 0) {
        continue;
      }

      if (currentContext === undefined) {
        currentContext = this.checkForContextStart(line);
        continue;
      }

      if (line.match(isEndOfDeclaration)) {
        currentContext = undefined;
        continue;
      }

      switch (currentContext.type) {
        case 'model':
          this.addLineToModel(currentContext.name, line);
          break;
        case 'enum':
          this.addLineToEnum(currentContext.name, line);
          break;
        case 'type':
          this.addLineToType(currentContext.name, line);
          break;

      }

    }

    return {
      models: this.models,
      enums: this.enums,
      types: this.types,
    };
  }

  addLineToModel(name = '', line = '') {
    line = line.trim();

    // probably an id, unique or other constraint defauts!
    if (line.match(/^@@/)) {
      return;
    }

    // each line is a field declaration
    let declarationInfo = line.split(' ');
    let fieldName = undefined;
    let fieldType = undefined;
    let isOptional = false;
    let isArray = false;
    let hasDefault = false;
    let defaultValue = undefined;

    for (let declaration of declarationInfo) {
      declaration = declaration.trim();

      if (declaration.length === 0) continue;

      if (fieldName == null) {
        fieldName = declaration;
        continue;
      }

      if (fieldType == null) {
        fieldType = declaration;
        if (fieldType.match(/.+?\?$/)) {
          isOptional = true;
          fieldType = fieldType.substring(0, fieldType.length - 1);
        }

        if (fieldType.match(/.+?\[\](\?)?/)) {
          isArray = true;
          fieldType = fieldType.substring(0, fieldType.length - 2);
        }
        continue;
      }

      // ignored declarations
      if (
        [
          '@id',
          '@unique',
          '@index'
        ].includes(declaration)
      ) {
        continue;
      }

      // try to mimic declarations
      // - default, check for primitive default values, ignore the rest
      if (declaration.match(/\@default\(.+\)$/) != null) {
        hasDefault = true;
        defaultValue = declaration.match(/\@default\((?<default>.+)\)$/).groups.default;
        // is function like?
        if(defaultValue.match(/.+\(.*?\)$/)) {
          defaultValue = undefined;
        }
        continue;
      }
      console.log('ignoring declaration of ', declaration, 'for', fieldName);
    }
    if (!Array.isArray(this.models[name])) {
      this.models[name] = [];
    }
    this.models[name].push({
      name: fieldName,
      type: fieldType,
      optional: isOptional,
      array: isArray,
      hasDefault,
      defaultValue
    });
  }

  addLineToEnum(name = '', line = '') {

  }

  addLineToType(name = '', line = '') {

  }

  checkForContextStart(line = '') {

    if (line.match(isEnumDeclaration)) {
      let matches = line.match(isEnumDeclaration);
      return {
        type: 'enum',
        name: matches.groups.name
      };
    }

    if (line.match(isModelDeclaration)) {
      let matches = line.match(isModelDeclaration);
      return {
        type: 'model',
        name: matches.groups.name
      };
    }

    if (line.match(isTypeDeclaration)) {
      let matches = line.match(isTypeDeclaration);
      return {
        type: 'type',
        name: matches.groups.name
      };
    }

    return undefined;
  }

}