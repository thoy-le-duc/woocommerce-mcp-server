#!/usr/bin/env node
// src/index.ts
import readline from 'readline';
import { handleMcpRequest } from './mcp_handler.js';
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
});
console.error('WooCommerce MCP server started. Listening on stdin...');
rl.on('line', async (line) => {
    let request;
    try {
        request = JSON.parse(line);
    }
    catch (err) {
        console.error('Failed to parse JSON:', err);
        return;
    }
    const { id = null, method, params = {} } = request;
    try {
        if (method === 'initialize') {
            const initResult = {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: {
                    name: 'woocommerce-mcp-server',
                    version: '2024-11-05',
                    description: 'WooCommerce MCP server',
                },
            };
            process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: initResult }) + '\n');
            return;
        }
        if (method === 'tools.list') {
            process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: [] }) + '\n');
            return;
        }
        const result = await handleMcpRequest(method, params);
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`MCP handler error (method=${method}, id=${id}):`, err);
        process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: 'Server error', data: errorMessage },
        }) + '\n');
    }
});
//# sourceMappingURL=index.js.map