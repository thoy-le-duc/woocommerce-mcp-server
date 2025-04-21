// src/mcp_handler.ts
import axios from 'axios';
import { isSimpleAxiosError, isWordPressErrorData } from './types.js'; // Extension .js requise
import defaultConfig from './config.js'; // Extension .js requise
// --- Listes des méthodes supportées ---
// Pour les points de terminaison standard de l'API WordPress (/wp/v2)
const WP_METHODS = new Set([
    'create_post', 'get_posts', 'update_post',
    'get_post_meta', 'update_post_meta', 'create_post_meta', 'delete_post_meta'
]);
// Pour les points de terminaison de l'API WooCommerce (/wc/v3)
const WOO_METHODS = new Set([
    'get_products', 'get_product', 'create_product', 'update_product', 'delete_product',
    'get_orders', 'get_order', 'create_order', 'update_order', 'delete_order',
    'get_customers', 'get_customer', 'create_customer', 'update_customer', 'delete_customer',
    'get_sales_report', 'get_products_report', 'get_orders_report', 'get_categories_report',
    'get_customers_report', 'get_stock_report', 'get_coupons_report', 'get_taxes_report',
    // Shipping
    'get_shipping_zones', 'get_shipping_zone', 'create_shipping_zone', 'update_shipping_zone', 'delete_shipping_zone',
    'get_shipping_methods', 'get_shipping_zone_methods', 'create_shipping_zone_method', 'update_shipping_zone_method', 'delete_shipping_zone_method',
    'get_shipping_zone_locations', 'update_shipping_zone_locations',
    // Taxes
    'get_tax_classes', 'create_tax_class', 'delete_tax_class',
    'get_tax_rates', 'get_tax_rate', 'create_tax_rate', 'update_tax_rate', 'delete_tax_rate',
    // Coupons
    'get_coupons', 'get_coupon', 'create_coupon', 'update_coupon', 'delete_coupon',
    // Order Notes
    'get_order_notes', 'get_order_note', 'create_order_note', 'delete_order_note',
    // Order Refunds
    'get_order_refunds', 'get_order_refund', 'create_order_refund', 'delete_order_refund',
    // Product Variations
    'get_product_variations', 'get_product_variation', 'create_product_variation', 'update_product_variation', 'delete_product_variation',
    // Product Attributes
    'get_product_attributes', 'get_product_attribute', 'create_product_attribute', 'update_product_attribute', 'delete_product_attribute',
    // Product Attribute Terms
    'get_attribute_terms', 'get_attribute_term', 'create_attribute_term', 'update_attribute_term', 'delete_attribute_term',
    // Product Categories
    'get_product_categories', 'get_product_category', 'create_product_category', 'update_product_category', 'delete_product_category',
    // Product Tags
    'get_product_tags', 'get_product_tag', 'create_product_tag', 'update_product_tag', 'delete_product_tag',
    // Product Reviews
    'get_product_reviews', 'get_product_review', 'create_product_review', 'update_product_review', 'delete_product_review',
    // Payment Gateways
    'get_payment_gateways', 'get_payment_gateway', 'update_payment_gateway',
    // Settings
    'get_settings', 'get_setting_options', 'update_setting_option',
    // System Status
    'get_system_status', 'get_system_status_tools', 'run_system_status_tool',
    // Data
    'get_data', 'get_continents', 'get_countries', 'get_currencies', 'get_current_currency',
    // Meta data (WooCommerce uses product/order/customer update)
    'get_product_meta', 'update_product_meta', 'create_product_meta', 'delete_product_meta',
    'get_order_meta', 'update_order_meta', 'create_order_meta', 'delete_order_meta',
    'get_customer_meta', 'update_customer_meta', 'create_customer_meta', 'delete_customer_meta'
]);
/**
 * Handles an MCP request by calling the appropriate WordPress or WooCommerce API endpoint.
 *
 * @param method The JSON-RPC method name (e.g., 'get_products', 'create_post').
 * @param params The parameters for the method, potentially including API credentials.
 * @returns A promise that resolves with the result from the API.
 * @throws An error if the request fails or parameters are invalid.
 */
export async function handleMcpRequest(method, params = {}) {
    try { // <--- Début du TRY principal
        // 1. Determine Credentials: Start with an empty object, then populate conditionally.
        const creds = {}; // Start empty, satisfies optional properties
        // Get potential values, giving params priority
        const siteUrlValue = params.siteUrl || defaultConfig.siteUrl;
        const usernameValue = params.username || defaultConfig.username;
        const passwordValue = params.password || defaultConfig.password;
        const consumerKeyValue = params.consumerKey || defaultConfig.consumerKey;
        const consumerSecretValue = params.consumerSecret || defaultConfig.consumerSecret;
        // Add property to 'creds' ONLY if it has a truthy value (non-empty string)
        if (siteUrlValue)
            creds.siteUrl = siteUrlValue;
        if (usernameValue)
            creds.username = usernameValue;
        if (passwordValue)
            creds.password = passwordValue;
        if (consumerKeyValue)
            creds.consumerKey = consumerKeyValue;
        if (consumerSecretValue)
            creds.consumerSecret = consumerSecretValue;
        // 2. Validate Site URL (now check creds.siteUrl which might be absent)
        if (!creds.siteUrl) {
            throw new Error('WordPress site URL not provided (or is empty) in environment variables or request parameters');
        }
        // Remove trailing slash from site URL (safe now, siteUrl is confirmed string)
        const cleanSiteUrl = creds.siteUrl.replace(/\/$/, '');
        // 3. Determine API Type and Validate Credentials
        let client;
        if (WP_METHODS.has(method)) {
            // Validation uses creds properties which may or may not exist now
            if (!creds.username || !creds.password) {
                throw new Error(`WordPress username and password are required for method '${method}' but not provided.`);
            }
            const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
            client = axios.create({
                baseURL: `${cleanSiteUrl}/wp-json/wp/v2`,
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/json',
                },
            });
        }
        else if (WOO_METHODS.has(method)) {
            if (!creds.consumerKey || !creds.consumerSecret) {
                throw new Error(`WooCommerce Consumer Key and Secret are required for method '${method}' but not provided.`);
            }
            client = axios.create({
                baseURL: `${cleanSiteUrl}/wp-json/wc/v3`,
                params: {
                    consumer_key: creds.consumerKey,
                    consumer_secret: creds.consumerSecret
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }
        else {
            throw new Error(`Unknown or unsupported MCP method: ${method}`);
        }
        // --- 4. Execute Request based on Method ---
        switch (method) {
            // === WordPress Posts ===
            case 'create_post':
                if (!params.title || !params.content) {
                    throw new Error('Title and content are required for create_post');
                }
                return (await client.post('/posts', {
                    title: params.title,
                    content: params.content,
                    status: params.status || 'draft',
                })).data;
            case 'get_posts':
                return (await client.get('/posts', {
                    params: {
                        per_page: params.perPage || 10,
                        page: params.page || 1,
                        ...(params.filters || {}) // Spread filters if provided
                    },
                })).data;
            case 'update_post':
                if (!params.postId) {
                    throw new Error('postId is required for update_post');
                }
                const updateData = {};
                if (params.title)
                    updateData.title = params.title;
                if (params.content)
                    updateData.content = params.content;
                if (params.status)
                    updateData.status = params.status;
                if (Object.keys(updateData).length === 0) {
                    throw new Error('No data provided to update for update_post');
                }
                return (await client.post(`/posts/${params.postId}`, updateData)).data; // WP uses POST for updates too
            // === WordPress Post Meta ===
            case 'get_post_meta':
                if (!params.postId)
                    throw new Error('postId is required for get_post_meta');
                // Let's call the base meta endpoint and let user filter if necessary
                console.warn("Accessing specific post meta key via REST might require custom endpoint or plugin.");
                // Get all meta for the post
                const allMetaResponse = await client.get(`/posts/${params.postId}?context=edit`); // context=edit often needed for meta
                return allMetaResponse.data.meta || {}; // Return the meta object
            case 'create_post_meta':
            case 'update_post_meta': // WP typically handles create/update via main post update
                if (!params.postId)
                    throw new Error('postId is required for create/update_post_meta');
                if (!params.metaKey)
                    throw new Error('metaKey is required for create/update_post_meta');
                if (params.metaValue === undefined)
                    throw new Error('metaValue is required for create/update_post_meta');
                return (await client.post(`/posts/${params.postId}`, {
                    meta: {
                        [params.metaKey]: params.metaValue
                    }
                })).data.meta; // Return the updated meta section
            case 'delete_post_meta':
                if (!params.postId)
                    throw new Error('postId is required for delete_post_meta');
                if (!params.metaKey)
                    throw new Error('metaKey is required for delete_post_meta');
                // Deleting meta usually means setting it to null or empty string via update
                return (await client.post(`/posts/${params.postId}`, {
                    meta: {
                        [params.metaKey]: null // Or '' depending on how WP handles it
                    }
                })).data.meta;
            // === WooCommerce Products ===
            case 'get_products':
                return (await client.get('/products', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_product':
                if (!params.productId)
                    throw new Error('productId is required for get_product');
                return (await client.get(`/products/${params.productId}`)).data;
            case 'create_product':
                if (!params.productData)
                    throw new Error('productData is required for create_product');
                return (await client.post('/products', params.productData)).data;
            case 'update_product':
                if (!params.productId)
                    throw new Error('productId is required for update_product');
                if (!params.productData)
                    throw new Error('productData is required for update_product');
                return (await client.put(`/products/${params.productId}`, params.productData)).data;
            case 'delete_product':
                if (!params.productId)
                    throw new Error('productId is required for delete_product');
                return (await client.delete(`/products/${params.productId}`, { params: { force: params.force || false } })).data;
            // === WooCommerce Orders ===
            case 'get_orders':
                return (await client.get('/orders', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_order':
                if (!params.orderId)
                    throw new Error('orderId is required for get_order');
                return (await client.get(`/orders/${params.orderId}`)).data;
            case 'create_order':
                if (!params.orderData)
                    throw new Error('orderData is required for create_order');
                return (await client.post('/orders', params.orderData)).data;
            case 'update_order':
                if (!params.orderId)
                    throw new Error('orderId is required for update_order');
                if (!params.orderData)
                    throw new Error('orderData is required for update_order');
                return (await client.put(`/orders/${params.orderId}`, params.orderData)).data;
            case 'delete_order':
                if (!params.orderId)
                    throw new Error('orderId is required for delete_order');
                return (await client.delete(`/orders/${params.orderId}`, { params: { force: params.force || false } })).data;
            // === WooCommerce Customers ===
            case 'get_customers':
                return (await client.get('/customers', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_customer':
                if (!params.customerId)
                    throw new Error('customerId is required for get_customer');
                return (await client.get(`/customers/${params.customerId}`)).data;
            case 'create_customer':
                if (!params.customerData)
                    throw new Error('customerData is required for create_customer');
                return (await client.post('/customers', params.customerData)).data;
            case 'update_customer':
                if (!params.customerId)
                    throw new Error('customerId is required for update_customer');
                if (!params.customerData)
                    throw new Error('customerData is required for update_customer');
                return (await client.put(`/customers/${params.customerId}`, params.customerData)).data;
            case 'delete_customer':
                if (!params.customerId)
                    throw new Error('customerId is required for delete_customer');
                return (await client.delete(`/customers/${params.customerId}`, { params: { force: params.force || false, reassign: params.reassign } })).data; // Added reassign option
            // === WooCommerce Reports ===
            // Note: Verify endpoint paths against your WC API version documentation
            case 'get_sales_report':
                return (await client.get('/reports/sales', { params: { period: params.period, date_min: params.dateMin, date_max: params.dateMax, ...(params.filters || {}) } })).data;
            case 'get_products_report':
                return (await client.get('/reports/products/totals', { params: { date_min: params.dateMin, date_max: params.dateMax, ...(params.filters || {}) } })).data;
            case 'get_orders_report':
                return (await client.get('/reports/orders/totals', { params: { date_min: params.dateMin, date_max: params.dateMax, ...(params.filters || {}) } })).data;
            case 'get_categories_report':
                return (await client.get('/reports/categories/totals', { params: { ...(params.filters || {}) } })).data;
            case 'get_customers_report':
                return (await client.get('/reports/customers/totals', { params: { date_min: params.dateMin, date_max: params.dateMax, ...(params.filters || {}) } })).data;
            case 'get_stock_report':
                console.warn("Direct '/reports/stock' endpoint might not exist. Check WC REST API docs. Trying alternative product query.");
                return (await client.get('/products', { params: { stock_status: 'instock', per_page: params.perPage || 100 } })).data;
            case 'get_coupons_report':
                return (await client.get('/reports/coupons/totals', { params: { date_min: params.dateMin, date_max: params.dateMax, ...(params.filters || {}) } })).data;
            case 'get_taxes_report':
                return (await client.get('/reports/taxes/totals', { params: { date_min: params.dateMin, date_max: params.dateMax, ...(params.filters || {}) } })).data;
            // === WooCommerce Shipping Zones ===
            case 'get_shipping_zones':
                return (await client.get('/shipping/zones')).data;
            case 'get_shipping_zone':
                if (!params.zoneId)
                    throw new Error('zoneId is required for get_shipping_zone');
                return (await client.get(`/shipping/zones/${params.zoneId}`)).data;
            case 'create_shipping_zone':
                if (!params.zoneData)
                    throw new Error('zoneData is required for create_shipping_zone');
                return (await client.post('/shipping/zones', params.zoneData)).data;
            case 'update_shipping_zone':
                if (!params.zoneId)
                    throw new Error('zoneId is required for update_shipping_zone');
                if (!params.zoneData)
                    throw new Error('zoneData is required for update_shipping_zone');
                return (await client.put(`/shipping/zones/${params.zoneId}`, params.zoneData)).data;
            case 'delete_shipping_zone':
                if (!params.zoneId)
                    throw new Error('zoneId is required for delete_shipping_zone');
                return (await client.delete(`/shipping/zones/${params.zoneId}`, { params: { force: params.force ?? true } })).data; // Default force=true
            // === WooCommerce Shipping Methods (within zones) ===
            case 'get_shipping_methods': // Gets registered method types, not instances
                return (await client.get('/shipping_methods')).data;
            case 'get_shipping_zone_methods':
                if (!params.zoneId)
                    throw new Error('zoneId is required for get_shipping_zone_methods');
                return (await client.get(`/shipping/zones/${params.zoneId}/methods`)).data;
            case 'create_shipping_zone_method':
                if (!params.zoneId)
                    throw new Error('zoneId is required for create_shipping_zone_method');
                if (!params.methodData)
                    throw new Error('methodData is required for create_shipping_zone_method');
                return (await client.post(`/shipping/zones/${params.zoneId}/methods`, params.methodData)).data;
            case 'update_shipping_zone_method':
                if (!params.zoneId)
                    throw new Error('zoneId is required for update_shipping_zone_method');
                if (!params.instanceId)
                    throw new Error('instanceId is required for update_shipping_zone_method');
                if (!params.methodData)
                    throw new Error('methodData is required for update_shipping_zone_method');
                return (await client.put(`/shipping/zones/${params.zoneId}/methods/${params.instanceId}`, params.methodData)).data;
            case 'delete_shipping_zone_method':
                if (!params.zoneId)
                    throw new Error('zoneId is required for delete_shipping_zone_method');
                if (!params.instanceId)
                    throw new Error('instanceId is required for delete_shipping_zone_method');
                return (await client.delete(`/shipping/zones/${params.zoneId}/methods/${params.instanceId}`, { params: { force: params.force ?? true } })).data;
            // === Shipping Zone Locations ===
            case 'get_shipping_zone_locations':
                if (!params.zoneId)
                    throw new Error('zoneId is required for get_shipping_zone_locations');
                return (await client.get(`/shipping/zones/${params.zoneId}/locations`)).data;
            case 'update_shipping_zone_locations': // Usually PUT or POST with locations array
                if (!params.zoneId)
                    throw new Error('zoneId is required for update_shipping_zone_locations');
                if (!params.locations)
                    throw new Error('locations array is required for update_shipping_zone_locations');
                return (await client.post(`/shipping/zones/${params.zoneId}/locations`, params.locations)).data; // Check API docs if PUT is preferred
            // === Tax Classes ===
            case 'get_tax_classes':
                return (await client.get('/taxes/classes')).data;
            case 'create_tax_class':
                if (!params.taxClassData || !params.taxClassData.name)
                    throw new Error('taxClassData with at least name is required for create_tax_class');
                return (await client.post('/taxes/classes', params.taxClassData)).data;
            case 'delete_tax_class':
                if (!params.slug)
                    throw new Error('slug is required for delete_tax_class');
                return (await client.delete(`/taxes/classes/${params.slug}`, { params: { force: params.force ?? true } })).data;
            // === Tax Rates ===
            case 'get_tax_rates':
                return (await client.get('/taxes', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_tax_rate':
                if (!params.rateId)
                    throw new Error('rateId is required for get_tax_rate');
                return (await client.get(`/taxes/${params.rateId}`)).data;
            case 'create_tax_rate':
                if (!params.taxRateData)
                    throw new Error('taxRateData is required for create_tax_rate');
                return (await client.post('/taxes', params.taxRateData)).data;
            case 'update_tax_rate':
                if (!params.rateId)
                    throw new Error('rateId is required for update_tax_rate');
                if (!params.taxRateData)
                    throw new Error('taxRateData is required for update_tax_rate');
                return (await client.put(`/taxes/${params.rateId}`, params.taxRateData)).data;
            case 'delete_tax_rate':
                if (!params.rateId)
                    throw new Error('rateId is required for delete_tax_rate');
                return (await client.delete(`/taxes/${params.rateId}`, { params: { force: params.force ?? true } })).data;
            // === Coupons ===
            case 'get_coupons':
                return (await client.get('/coupons', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_coupon':
                if (!params.couponId)
                    throw new Error('couponId is required for get_coupon');
                return (await client.get(`/coupons/${params.couponId}`)).data;
            case 'create_coupon':
                if (!params.couponData)
                    throw new Error('couponData is required for create_coupon');
                return (await client.post('/coupons', params.couponData)).data;
            case 'update_coupon':
                if (!params.couponId)
                    throw new Error('couponId is required for update_coupon');
                if (!params.couponData)
                    throw new Error('couponData is required for update_coupon');
                return (await client.put(`/coupons/${params.couponId}`, params.couponData)).data;
            case 'delete_coupon':
                if (!params.couponId)
                    throw new Error('couponId is required for delete_coupon');
                return (await client.delete(`/coupons/${params.couponId}`, { params: { force: params.force ?? true } })).data;
            // === Order Notes ===
            case 'get_order_notes':
                if (!params.orderId)
                    throw new Error('orderId is required for get_order_notes');
                return (await client.get(`/orders/${params.orderId}/notes`, { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_order_note':
                if (!params.orderId)
                    throw new Error('orderId is required for get_order_note');
                if (!params.noteId)
                    throw new Error('noteId is required for get_order_note');
                return (await client.get(`/orders/${params.orderId}/notes/${params.noteId}`)).data;
            case 'create_order_note':
                if (!params.orderId)
                    throw new Error('orderId is required for create_order_note');
                if (!params.noteData || !params.noteData.note)
                    throw new Error('noteData with note content is required for create_order_note');
                return (await client.post(`/orders/${params.orderId}/notes`, params.noteData)).data;
            case 'delete_order_note':
                if (!params.orderId)
                    throw new Error('orderId is required for delete_order_note');
                if (!params.noteId)
                    throw new Error('noteId is required for delete_order_note');
                return (await client.delete(`/orders/${params.orderId}/notes/${params.noteId}`, { params: { force: params.force ?? true } })).data;
            // === Order Refunds ===
            case 'get_order_refunds':
                if (!params.orderId)
                    throw new Error('orderId is required for get_order_refunds');
                return (await client.get(`/orders/${params.orderId}/refunds`, { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_order_refund':
                if (!params.orderId)
                    throw new Error('orderId is required for get_order_refund');
                if (!params.refundId)
                    throw new Error('refundId is required for get_order_refund');
                return (await client.get(`/orders/${params.orderId}/refunds/${params.refundId}`)).data;
            case 'create_order_refund':
                if (!params.orderId)
                    throw new Error('orderId is required for create_order_refund');
                if (!params.refundData)
                    throw new Error('refundData is required for create_order_refund');
                return (await client.post(`/orders/${params.orderId}/refunds`, params.refundData)).data;
            case 'delete_order_refund':
                if (!params.orderId)
                    throw new Error('orderId is required for delete_order_refund');
                if (!params.refundId)
                    throw new Error('refundId is required for delete_order_refund');
                return (await client.delete(`/orders/${params.orderId}/refunds/${params.refundId}`, { params: { force: params.force ?? true } })).data;
            // === Product Variations ===
            case 'get_product_variations':
                if (!params.productId)
                    throw new Error('productId is required for get_product_variations');
                return (await client.get(`/products/${params.productId}/variations`, { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_product_variation':
                if (!params.productId)
                    throw new Error('productId is required for get_product_variation');
                if (!params.variationId)
                    throw new Error('variationId is required for get_product_variation');
                return (await client.get(`/products/${params.productId}/variations/${params.variationId}`)).data;
            case 'create_product_variation':
                if (!params.productId)
                    throw new Error('productId is required for create_product_variation');
                if (!params.variationData)
                    throw new Error('variationData is required for create_product_variation');
                return (await client.post(`/products/${params.productId}/variations`, params.variationData)).data;
            case 'update_product_variation':
                if (!params.productId)
                    throw new Error('productId is required for update_product_variation');
                if (!params.variationId)
                    throw new Error('variationId is required for update_product_variation');
                if (!params.variationData)
                    throw new Error('variationData is required for update_product_variation');
                return (await client.put(`/products/${params.productId}/variations/${params.variationId}`, params.variationData)).data;
            case 'delete_product_variation':
                if (!params.productId)
                    throw new Error('productId is required for delete_product_variation');
                if (!params.variationId)
                    throw new Error('variationId is required for delete_product_variation');
                return (await client.delete(`/products/${params.productId}/variations/${params.variationId}`, { params: { force: params.force ?? true } })).data;
            // === Product Attributes ===
            case 'get_product_attributes':
                return (await client.get('/products/attributes', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_product_attribute':
                if (!params.attributeId)
                    throw new Error('attributeId is required for get_product_attribute');
                return (await client.get(`/products/attributes/${params.attributeId}`)).data;
            case 'create_product_attribute':
                if (!params.attributeData)
                    throw new Error('attributeData is required for create_product_attribute');
                return (await client.post('/products/attributes', params.attributeData)).data;
            case 'update_product_attribute':
                if (!params.attributeId)
                    throw new Error('attributeId is required for update_product_attribute');
                if (!params.attributeData)
                    throw new Error('attributeData is required for update_product_attribute');
                return (await client.put(`/products/attributes/${params.attributeId}`, params.attributeData)).data;
            case 'delete_product_attribute':
                if (!params.attributeId)
                    throw new Error('attributeId is required for delete_product_attribute');
                return (await client.delete(`/products/attributes/${params.attributeId}`, { params: { force: params.force ?? true } })).data;
            // === Product Attribute Terms ===
            case 'get_attribute_terms':
                if (!params.attributeId)
                    throw new Error('attributeId is required for get_attribute_terms');
                return (await client.get(`/products/attributes/${params.attributeId}/terms`, { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_attribute_term':
                if (!params.attributeId)
                    throw new Error('attributeId is required for get_attribute_term');
                if (!params.termId)
                    throw new Error('termId is required for get_attribute_term');
                return (await client.get(`/products/attributes/${params.attributeId}/terms/${params.termId}`)).data;
            case 'create_attribute_term':
                if (!params.attributeId)
                    throw new Error('attributeId is required for create_attribute_term');
                if (!params.termData)
                    throw new Error('termData is required for create_attribute_term');
                return (await client.post(`/products/attributes/${params.attributeId}/terms`, params.termData)).data;
            case 'update_attribute_term':
                if (!params.attributeId)
                    throw new Error('attributeId is required for update_attribute_term');
                if (!params.termId)
                    throw new Error('termId is required for update_attribute_term');
                if (!params.termData)
                    throw new Error('termData is required for update_attribute_term');
                return (await client.put(`/products/attributes/${params.attributeId}/terms/${params.termId}`, params.termData)).data;
            case 'delete_attribute_term':
                if (!params.attributeId)
                    throw new Error('attributeId is required for delete_attribute_term');
                if (!params.termId)
                    throw new Error('termId is required for delete_attribute_term');
                return (await client.delete(`/products/attributes/${params.attributeId}/terms/${params.termId}`, { params: { force: params.force ?? true } })).data;
            // === Product Categories ===
            case 'get_product_categories':
                return (await client.get('/products/categories', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_product_category':
                if (!params.categoryId)
                    throw new Error('categoryId is required for get_product_category');
                return (await client.get(`/products/categories/${params.categoryId}`)).data;
            case 'create_product_category':
                if (!params.categoryData)
                    throw new Error('categoryData is required for create_product_category');
                return (await client.post('/products/categories', params.categoryData)).data;
            case 'update_product_category':
                if (!params.categoryId)
                    throw new Error('categoryId is required for update_product_category');
                if (!params.categoryData)
                    throw new Error('categoryData is required for update_product_category');
                return (await client.put(`/products/categories/${params.categoryId}`, params.categoryData)).data;
            case 'delete_product_category':
                if (!params.categoryId)
                    throw new Error('categoryId is required for delete_product_category');
                return (await client.delete(`/products/categories/${params.categoryId}`, { params: { force: params.force ?? true } })).data;
            // === Product Tags ===
            case 'get_product_tags':
                return (await client.get('/products/tags', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_product_tag':
                if (!params.tagId)
                    throw new Error('tagId is required for get_product_tag');
                return (await client.get(`/products/tags/${params.tagId}`)).data;
            case 'create_product_tag':
                if (!params.tagData)
                    throw new Error('tagData is required for create_product_tag');
                return (await client.post('/products/tags', params.tagData)).data;
            case 'update_product_tag':
                if (!params.tagId)
                    throw new Error('tagId is required for update_product_tag');
                if (!params.tagData)
                    throw new Error('tagData is required for update_product_tag');
                return (await client.put(`/products/tags/${params.tagId}`, params.tagData)).data;
            case 'delete_product_tag':
                if (!params.tagId)
                    throw new Error('tagId is required for delete_product_tag');
                return (await client.delete(`/products/tags/${params.tagId}`, { params: { force: params.force ?? true } })).data;
            // === Product Reviews ===
            case 'get_product_reviews':
                return (await client.get('/products/reviews', { params: { per_page: params.perPage || 10, page: params.page || 1, ...(params.filters || {}) } })).data;
            case 'get_product_review':
                if (!params.reviewId)
                    throw new Error('reviewId is required for get_product_review');
                return (await client.get(`/products/reviews/${params.reviewId}`)).data;
            case 'create_product_review':
                if (!params.reviewData || !params.reviewData.product_id || !params.reviewData.review || !params.reviewData.reviewer || !params.reviewData.reviewer_email) {
                    throw new Error('reviewData with product_id, review, reviewer, and reviewer_email is required for create_product_review');
                }
                return (await client.post('/products/reviews', params.reviewData)).data;
            case 'update_product_review':
                if (!params.reviewId)
                    throw new Error('reviewId is required for update_product_review');
                if (!params.reviewData)
                    throw new Error('reviewData is required for update_product_review');
                return (await client.put(`/products/reviews/${params.reviewId}`, params.reviewData)).data;
            case 'delete_product_review':
                if (!params.reviewId)
                    throw new Error('reviewId is required for delete_product_review');
                return (await client.delete(`/products/reviews/${params.reviewId}`, { params: { force: params.force ?? true } })).data;
            // === Payment Gateways ===
            case 'get_payment_gateways':
                return (await client.get('/payment_gateways')).data;
            case 'get_payment_gateway':
                if (!params.gatewayId)
                    throw new Error('gatewayId is required for get_payment_gateway');
                return (await client.get(`/payment_gateways/${params.gatewayId}`)).data;
            case 'update_payment_gateway':
                if (!params.gatewayId)
                    throw new Error('gatewayId is required for update_payment_gateway');
                if (!params.gatewayData)
                    throw new Error('gatewayData is required for update_payment_gateway');
                return (await client.put(`/payment_gateways/${params.gatewayId}`, params.gatewayData)).data;
            // === Settings ===
            case 'get_settings': // Gets all setting groups
                return (await client.get('/settings')).data;
            case 'get_setting_options': // Gets settings within a group
                if (!params.group)
                    throw new Error('group (setting group id) is required for get_setting_options');
                return (await client.get(`/settings/${params.group}`)).data;
            case 'update_setting_option': // Updates a specific setting
                if (!params.group)
                    throw new Error('group (setting group id) is required for update_setting_option');
                if (!params.id)
                    throw new Error('id (setting id) is required for update_setting_option');
                if (!params.settingData || params.settingData.value === undefined)
                    throw new Error('settingData with a value property is required for update_setting_option');
                return (await client.put(`/settings/${params.group}/${params.id}`, params.settingData)).data;
            // === System Status ===
            case 'get_system_status':
                return (await client.get('/system_status')).data;
            case 'get_system_status_tools':
                return (await client.get('/system_status/tools')).data;
            case 'run_system_status_tool': // Usually PUT confirms/runs the tool
                if (!params.toolId)
                    throw new Error('toolId is required for run_system_status_tool');
                return (await client.put(`/system_status/tools/${params.toolId}`, {})).data; // Sending empty body often works
            // === Data Endpoints ===
            case 'get_data': // General data endpoint info
                return (await client.get('/data')).data;
            case 'get_continents':
                return (await client.get('/data/continents')).data;
            case 'get_countries':
                return (await client.get('/data/countries')).data;
            case 'get_currencies':
                return (await client.get('/data/currencies')).data;
            case 'get_current_currency':
                return (await client.get('/data/currencies/current')).data;
            // === WooCommerce Meta Data (Products, Orders, Customers) ===
            case 'get_product_meta':
            case 'get_order_meta':
            case 'get_customer_meta': {
                let id;
                let endpoint;
                if (method === 'get_product_meta') {
                    id = params.productId;
                    endpoint = `/products/${id}`;
                }
                else if (method === 'get_order_meta') {
                    id = params.orderId;
                    endpoint = `/orders/${id}`;
                }
                else {
                    id = params.customerId;
                    endpoint = `/customers/${id}`;
                } // customer meta
                if (!id)
                    throw new Error(`ID (productId, orderId, or customerId) is required for ${method}`);
                const response = await client.get(endpoint);
                const metaData = response.data.meta_data || [];
                if (params.metaKey) {
                    return metaData.filter(meta => meta.key === params.metaKey);
                }
                return metaData;
            }
            case 'create_product_meta':
            case 'update_product_meta':
            case 'create_order_meta':
            case 'update_order_meta':
            case 'create_customer_meta':
            case 'update_customer_meta': {
                let id;
                let endpoint;
                if (method.includes('product')) {
                    id = params.productId;
                    endpoint = `/products/${id}`;
                }
                else if (method.includes('order')) {
                    id = params.orderId;
                    endpoint = `/orders/${id}`;
                }
                else {
                    id = params.customerId;
                    endpoint = `/customers/${id}`;
                } // customer meta
                if (!id)
                    throw new Error(`ID (productId, orderId, or customerId) is required for ${method}`);
                if (!params.metaKey)
                    throw new Error(`metaKey is required for ${method}`);
                if (params.metaValue === undefined)
                    throw new Error(`metaValue is required for ${method}`);
                // Get current meta_data
                const currentObject = (await client.get(endpoint)).data;
                let metaData = currentObject.meta_data || [];
                // Find if key exists
                const existingMetaIndex = metaData.findIndex(meta => meta.key === params.metaKey);
                if (existingMetaIndex >= 0) {
                    // Update existing meta
                    const metaToUpdate = metaData[existingMetaIndex];
                    if (metaToUpdate) { // Check if it exists
                        metaToUpdate.value = params.metaValue;
                    }
                    else {
                        console.error(`[mcp_handler] Error: Could not find meta at index ${existingMetaIndex} despite check.`);
                    }
                }
                else {
                    // Add new meta
                    metaData.push({ key: params.metaKey, value: params.metaValue });
                }
                // Update the object with the modified meta_data
                const updateResponse = await client.put(endpoint, { meta_data: metaData });
                return updateResponse.data.meta_data;
            }
            case 'delete_product_meta':
            case 'delete_order_meta':
            case 'delete_customer_meta': {
                let id;
                let endpoint;
                if (method.includes('product')) {
                    id = params.productId;
                    endpoint = `/products/${id}`;
                }
                else if (method.includes('order')) {
                    id = params.orderId;
                    endpoint = `/orders/${id}`;
                }
                else {
                    id = params.customerId;
                    endpoint = `/customers/${id}`;
                } // customer meta
                if (!id)
                    throw new Error(`ID (productId, orderId, or customerId) is required for ${method}`);
                if (!params.metaKey)
                    throw new Error(`metaKey is required for ${method}`);
                // Get current meta_data
                const currentObject = (await client.get(endpoint)).data;
                let metaData = currentObject.meta_data || [];
                // Filter out the meta key to delete
                const updatedMetaData = metaData.filter(meta => meta.key !== params.metaKey);
                if (updatedMetaData.length === metaData.length) {
                    console.warn(`Meta key '${params.metaKey}' not found for ${endpoint}. No changes made.`);
                    return metaData;
                }
                // Update the object with the filtered meta_data
                const deleteResponse = await client.put(endpoint, { meta_data: updatedMetaData });
                return deleteResponse.data.meta_data;
            }
            // --- Default Case ---
            default:
                throw new Error(`Method handler not implemented or method unknown: ${method}`);
        } // <--- Fin du SWITCH
    } // <--- **FIN DU TRY**
    catch (err) { // <--- Début du CATCH
        // 5. Enhanced Error Handling
        let finalErrorMessage = 'An unexpected error occurred';
        // D'abord, vérifions si c'est une erreur Axios simple
        if (isSimpleAxiosError(err)) {
            // Maintenant, TypeScript sait que 'err' est de type SimpleAxiosError
            // Cas 1: Erreur avec une réponse du serveur (4xx, 5xx)
            if (err.response) {
                const status = err.response.status || 'unknown status';
                const responseData = err.response.data;
                let detailMessage = err.response.statusText || 'Failed request';
                if (isWordPressErrorData(responseData)) {
                    detailMessage = responseData.message;
                }
                else if (typeof responseData === 'string' && responseData.length > 0) {
                    detailMessage = responseData;
                }
                finalErrorMessage = `API Error (${status}): ${detailMessage}`;
                console.error("Axios Response Error Details:", JSON.stringify(responseData ?? 'No data', null, 2));
                // Cas 2: Erreur sans réponse (réseau, timeout) ou erreur de setup Axios
            }
            else {
                // Puisque c'est une SimpleAxiosError (qui est une Error), .message est sûr
                finalErrorMessage = `API Network/Setup Error: ${err.message}`;
            }
            // Ensuite, vérifions si c'est une autre instance d'Error standard
        }
        else if (err instanceof Error) {
            // Erreur JavaScript standard (validation, etc.)
            finalErrorMessage = err.message;
            // Enfin, si ce n'est rien de tout ça
        }
        else {
            // Non-Error object thrown
            finalErrorMessage = `An unknown error occurred: ${String(err)}`;
        }
        // Log et relance l'erreur
        console.error(`Error processing method '${method}': ${finalErrorMessage}`);
        throw new Error(finalErrorMessage);
    } // <--- **FIN DU CATCH**
} // <--- **FIN DE LA FONCTION handleMcpRequest**
//# sourceMappingURL=mcp_handler.js.map