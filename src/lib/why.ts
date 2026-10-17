/** One short line for a caught error (console.info without a stack trace). */
export const why = (e: unknown) => String((e as Error)?.message ?? e).split('\n')[0].slice(0, 120);
