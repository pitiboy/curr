const hasExplicitExt = /\.[cm]?[jt]sx?$/;

export async function resolve(specifier, context, nextResolve) {
  const relative =
    specifier.startsWith('./') || specifier.startsWith('../');
  if (relative && !hasExplicitExt.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // fall through to default resolution
    }
  }
  return nextResolve(specifier, context);
}
