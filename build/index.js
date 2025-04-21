#!/usr/bin/env node
// src/index.ts
// Importe la fonction pour créer une interface de lecture ligne par ligne
import { createInterface } from 'node:readline';
// Importe notre handler principal pour les requêtes MCP
import { handleMcpRequest } from './mcp_handler.js'; // Added .js
// Crée une interface readline pour lire depuis l'entrée standard (stdin)
// et écrire sur la sortie standard (stdout). 'terminal: false' est important
// car nous ne sommes pas dans un terminal interactif mais dans un pipe.
const rl = createInterface({
    input: process.stdin,
    output: process.stdout, // Pas vraiment utilisé pour l'output JSON, mais requis par createInterface
    terminal: false,
});
/**
 * Fonction pour écrire une réponse JSON-RPC sur stdout.
 * Assure que la sortie est une seule ligne JSON valide.
 * @param response L'objet de réponse JSON-RPC (succès ou erreur).
 */
function sendResponse(response) {
    try {
        const responseString = JSON.stringify(response);
        process.stdout.write(responseString + '\n'); // Ajoute une nouvelle ligne après chaque réponse
    }
    catch (error) {
        // Erreur très improbable lors de la sérialisation de notre propre réponse
        console.error("FATAL: Failed to stringify JSON-RPC response:", error);
        // On tente d'envoyer une erreur JSON-RPC minimale si possible
        const minimalError = {
            jsonrpc: '2.0',
            id: (response && typeof response === 'object' && 'id' in response) ? response.id : null,
            error: {
                code: -32603, // Internal error
                message: "Failed to serialize server response",
            }
        };
        try {
            process.stdout.write(JSON.stringify(minimalError) + '\n');
        }
        catch {
            // Abandonner si même ça échoue
        }
    }
}
/**
 * Formate une erreur en objet d'erreur JSON-RPC standard.
 * @param id L'ID de la requête originale (peut être null).
 * @param code Le code d'erreur JSON-RPC.
 * @param message Le message d'erreur.
 * @param data Données additionnelles (optionnel).
 * @returns L'objet d'erreur JSON-RPC formaté.
 */
function createJsonRpcError(id, code, message, data) {
    const errorObj = { code, message };
    if (data !== undefined) {
        errorObj.data = data;
    }
    return { jsonrpc: '2.0', id, error: errorObj };
}
// Affiche un message sur stderr au démarrage pour indiquer que le serveur est prêt.
// stderr est utilisé pour les logs afin de ne pas polluer stdout qui est réservé aux réponses JSON-RPC.
console.error('WooCommerce MCP server started. Listening on stdin...');
// Écoute l'événement 'line', qui est déclenché chaque fois qu'une ligne
// (terminée par \n) est reçue sur stdin.
rl.on('line', async (line) => {
    let request = null; // Initialise à null
    try {
        // 1. Parse la ligne en tant que JSON
        const parsedData = JSON.parse(line);
        // 2. Valide la structure de base de la requête JSON-RPC
        if (typeof parsedData === 'object' &&
            parsedData !== null &&
            parsedData.jsonrpc === '2.0' &&
            typeof parsedData.method === 'string' &&
            (parsedData.id === null || typeof parsedData.id === 'string' || typeof parsedData.id === 'number')) {
            request = parsedData; // Type assertion après validation
        }
        else {
            // Si la structure n'est pas valide, on envoie une erreur mais sans ID car on ne peut pas le garantir
            sendResponse(createJsonRpcError(null, -32600, 'Invalid Request', 'Received data is not a valid JSON-RPC 2.0 request object.'));
            return; // Stoppe le traitement de cette ligne
        }
        // --- MCP handshake ---
        // Si la méthode reçue est 'initialize', on renvoie directement les métadonnées du serveur
        if (request.method === 'initialize') {
            const initResult = {
                protocolVersion: '1.0.1',
                capabilities: {
                    tools: {}, // ← racine demandée par n8n
                },
                serverInfo: {
                    name: 'woocommerce-mcp-server',
                    version: '0.1.0',
                    description: 'WooCommerce MCP server',
                },
            };
            sendResponse({
                jsonrpc: '2.0',
                id: request.id,
                result: initResult,
            });
            return;
        }
        // 3. Appelle le handler principal avec la méthode et les paramètres
        // Les paramètres peuvent être absents, on passe un objet vide si c'est le cas.
        const result = await handleMcpRequest(request.method, request.params || {});
        // 4. Envoie la réponse de succès
        sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: result, // Le résultat retourné par handleMcpRequest
        });
    }
    catch (error) {
        // 5. Gestion des erreurs (du parsing JSON ou du handler)
        const requestId = request?.id ?? null; // Utilise l'ID de la requête si on a pu la parser, sinon null
        if (error instanceof SyntaxError) {
            // Erreur de parsing JSON
            sendResponse(createJsonRpcError(requestId, -32700, 'Parse error', error.message));
        }
        else if (error instanceof Error) {
            // Erreur venant de handleMcpRequest (API error, validation error, etc.)
            // Ou autre erreur interne. On utilise un code d'erreur serveur générique.
            sendResponse(createJsonRpcError(requestId, -32000, 'Server error', error.message));
        }
        else {
            // Cas très rare où quelque chose d'autre qu'une Error est thrown
            sendResponse(createJsonRpcError(requestId, -32000, 'Unknown server error', String(error)));
        }
        // Log l'erreur complète sur stderr pour le débogage serveur
        console.error(`[Error for Request ID: ${requestId ?? 'unknown'}]`, error);
    }
});
// Gère la fermeture propre lorsque le processus reçoit SIGINT (ex: Ctrl+C)
// ou lorsque l'interface readline est fermée (par exemple, si stdin est fermé).
rl.on('close', () => {
    console.error('Stdin closed. WooCommerce MCP server shutting down.');
    process.exit(0); // Termine le processus Node.js proprement
});
process.on('SIGINT', () => {
    console.error('Received SIGINT. Shutting down...');
    rl.close(); // Déclenchera l'événement 'close' ci-dessus
});
process.on('SIGTERM', () => {
    console.error('Received SIGTERM. Shutting down...');
    rl.close();
});
//# sourceMappingURL=index.js.map