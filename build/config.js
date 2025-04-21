// Importe l'interface depuis types.ts
/**
 * Reads the default WordPress/WooCommerce credentials from environment variables.
 * Provides empty strings as defaults if the variables are not set.
 */
function loadDefaultCredentials() {
    // process.env contient les variables d'environnement.
    // L'opérateur '||' assigne '' si la variable n'est pas définie ou vide.
    const siteUrl = process.env.WORDPRESS_SITE_URL || '';
    const username = process.env.WORDPRESS_USERNAME || '';
    const password = process.env.WORDPRESS_PASSWORD || '';
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';
    // Retourne un objet contenant ces valeurs
    return {
        siteUrl,
        username,
        password,
        consumerKey,
        consumerSecret,
    };
}
// Charge la configuration une seule fois au démarrage du module
const defaultConfig = loadDefaultCredentials();
// Exporte la configuration chargée pour qu'elle soit utilisable ailleurs
export default defaultConfig;
// Optionnel : On peut aussi exporter la fonction si on veut pouvoir la recharger (peu probable ici)
// export { loadDefaultCredentials };
//# sourceMappingURL=config.js.map