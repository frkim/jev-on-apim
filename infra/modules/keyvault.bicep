@description('Azure region.')
param location string

@description('Key Vault name (3-24 chars).')
@maxLength(24)
param keyVaultName string

@description('Jev API key stored as a Key Vault secret.')
@secure()
param jevApiKey string

@description('Principal id of the managed identity that reads the secret (APIM).')
param readerPrincipalId string

@description('Resource tags.')
param tags object

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource jevSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jev-api-key'
  properties: {
    value: jevApiKey
    contentType: 'text/plain'
  }
}

resource secretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, readerPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: readerPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

output keyVaultName string = keyVault.name
output jevSecretUri string = jevSecret.properties.secretUriWithVersion
output jevSecretVersionlessUri string = jevSecret.properties.secretUri
