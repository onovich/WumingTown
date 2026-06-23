export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!shouldRetryWithTs(specifier, error)) {
      throw error;
    }

    return defaultResolve(`${specifier}.ts`, context, defaultResolve);
  }
}

function shouldRetryWithTs(specifier, error) {
  return (
    error !== null &&
    typeof error === "object" &&
    error.code === "ERR_MODULE_NOT_FOUND" &&
    (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("file:")) &&
    !specifier.endsWith(".ts")
  );
}
