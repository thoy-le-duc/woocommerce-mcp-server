// src/types.ts
/**
 * Type guard to check if an error object conforms to the WordPressErrorData structure.
 */
export function isWordPressErrorData(error) {
    return (error !== null &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        // Optionally check for 'code' or 'data' if needed for more strictness
        (!('code' in error) || typeof error.code === 'string'));
}
/**
 * Type guard to check if an error potentially comes from Axios, looking for the 'response' property.
 */
export function isSimpleAxiosError(error) {
    return error instanceof Error && 'response' in error;
}
//# sourceMappingURL=types.js.map