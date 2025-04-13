export const camelCase = (str: string) =>
  str
    .toLowerCase()
    .replace(/([-_][a-z0-9])/g, (group) =>
      group.toUpperCase().replace("-", "").replace("_", ""),
    );

export const pascalCase = (str: string) =>
  camelCase(str).replace(/^[a-z0-9]/, (char) => char.toUpperCase());
