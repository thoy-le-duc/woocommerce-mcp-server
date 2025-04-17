// src/types.ts

/**
 * Represents a standard JSON-RPC 2.0 Request object.
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null; // Allow null for notifications, though we might not handle them specifically
  method: string;
  params?: any; // Parameters can be structured object or array, 'any' provides flexibility
}

/**
 * Represents a standard JSON-RPC 2.0 Response object (Success).
 */
export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result: any;
}

/**
 * Represents the error structure within a JSON-RPC 2.0 Error Response.
 */
export interface JsonRpcErrorObject {
  code: number; // Standard JSON-RPC error codes or custom codes
  message: string;
  data?: any; // Optional field for additional error details
}

/**
 * Represents a standard JSON-RPC 2.0 Response object (Error).
 */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorObject;
}

/**
 * Represents either a success or error JSON-RPC 2.0 Response.
 */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * Structure for WordPress-specific error messages often found in API responses.
 */
export interface WordPressErrorData {
  code?: string; // e.g., 'rest_post_invalid_id', 'woocommerce_rest_invalid_product_id'
  message: string;
  data?: {
    status?: number; // HTTP status code
    params?: Record<string, string>; // Parameters related to the error
    details?: any; // More specific error details
  };
}

/**
 * Type guard to check if an error object conforms to the WordPressErrorData structure.
 */
export function isWordPressErrorData(error: unknown): error is WordPressErrorData {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as WordPressErrorData).message === 'string' &&
    // Optionally check for 'code' or 'data' if needed for more strictness
    (!('code' in error) || typeof (error as WordPressErrorData).code === 'string')
  );
}


/**
 * Represents the structure of an error thrown by Axios, focusing on the response part.
 * We define it more narrowly than the generic AxiosError type for our specific needs.
 */
export interface SimpleAxiosError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    data?: unknown; // The raw response data, could be WordPressErrorData or something else
  };
  // Other potential Axios properties like 'config', 'request', 'code' are omitted for simplicity
}

/**
 * Type guard to check if an error potentially comes from Axios, looking for the 'response' property.
 */
export function isSimpleAxiosError(error: unknown): error is SimpleAxiosError {
  return error instanceof Error && 'response' in error;
}


/**
 * Represents the configuration options for connecting to WordPress/WooCommerce.
 * Can come from environment variables or request parameters.
 */

export interface WcApiCredentials {
    siteUrl?: string;          // Revenir à ?:
    username?: string;         // Revenir à ?:
    password?: string;         // Revenir à ?:
    consumerKey?: string;      // Revenir à ?:
    consumerSecret?: string;   // Revenir à ?:
}
// ...
/**
 * Represents the parameters specifically needed for the MCP handler function,
 * including API credentials and the actual method parameters.
 */
export interface McpHandlerParams extends WcApiCredentials {
    // We include specific known parameters here, but allow others via [key: string]: any
    // --- Common Parameters ---
    perPage?: number;
    page?: number;
    filters?: Record<string, any>; // For list endpoints
    force?: boolean; // For delete operations

    // --- WordPress Post Parameters ---
    postId?: number | string;
    title?: string;
    content?: string;
    status?: 'publish' | 'future' | 'draft' | 'pending' | 'private';

    // --- WooCommerce Product Parameters ---
    productId?: number | string;
    productData?: Record<string, any>; // Data for creating/updating products

    // --- WooCommerce Order Parameters ---
    orderId?: number | string;
    orderData?: Record<string, any>; // Data for creating/updating orders

    // --- WooCommerce Customer Parameters ---
    customerId?: number | string;
    customerData?: Record<string, any>; // Data for creating/updating customers

    // --- Report Parameters ---
    period?: 'week' | 'month' | 'last_month' | 'year';
    dateMin?: string; // YYYY-MM-DD
    dateMax?: string; // YYYY-MM-DD

    // --- Shipping Zone Parameters ---
    zoneId?: number | string;
    zoneData?: Record<string, any>;

    // --- Shipping Method Parameters ---
    instanceId?: number | string;
    methodData?: Record<string, any>;
    locations?: Record<string, any>[]; // Array of location objects

    // --- Tax Class Parameters ---
    taxClassData?: Record<string, any>;
    slug?: string; // Tax class slug

    // --- Tax Rate Parameters ---
    rateId?: number | string;
    taxRateData?: Record<string, any>;

    // --- Coupon Parameters ---
    couponId?: number | string;
    couponData?: Record<string, any>;

    // --- Order Note Parameters ---
    noteId?: number | string;
    noteData?: Record<string, any>;

    // --- Refund Parameters ---
    refundId?: number | string;
    refundData?: Record<string, any>;

    // --- Variation Parameters ---
    variationId?: number | string;
    variationData?: Record<string, any>;

    // --- Attribute Parameters ---
    attributeId?: number | string;
    attributeData?: Record<string, any>;

    // --- Attribute Term Parameters ---
    termId?: number | string;
    termData?: Record<string, any>;

    // --- Category Parameters ---
    categoryId?: number | string;
    categoryData?: Record<string, any>;

    // --- Tag Parameters ---
    tagId?: number | string;
    tagData?: Record<string, any>;

    // --- Review Parameters ---
    reviewId?: number | string;
    reviewData?: Record<string, any>;

    // --- Payment Gateway Parameters ---
    gatewayId?: string;
    gatewayData?: Record<string, any>;

    // --- Settings Parameters ---
    group?: string; // Settings group ID (e.g., 'general', 'products')
    id?: string;    // Setting ID within the group
    settingData?: Record<string, any>;

    // --- System Status Parameters ---
    toolId?: string;

    // --- Meta Parameters ---
    metaId?: number | string;
    metaKey?: string;
    metaValue?: any;

    // Allow any other parameters that might be passed
    [key: string]: any;
}
