import { ManagedIdentityCredential } from '@azure/identity'
export const getToken = async (scope: string | string[], tenantId?: string): Promise<string> => {
    const managedIdentityCredential = new ManagedIdentityCredential({
        clientId: process.env.CLIENT_ID
    });
    const scopes = Array.isArray(scope) ? scope : [scope];
    const tokenResponse = await managedIdentityCredential.getToken(scopes, {
        tenantId: tenantId
    });

    return tokenResponse.token;
};
