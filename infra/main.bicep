targetScope = 'resourceGroup'

@description('Short workload name used in resource names.')
@minLength(3)
@maxLength(10)
param workload string = 'jevapim'

@description('Environment name.')
@allowed([
  'dev'
  'test'
  'prod'
])
param environmentName string = 'dev'

@description('Region for APIM, Key Vault and monitoring.')
param location string = resourceGroup().location

@description('Region for the Static Web App (must be a supported SWA region).')
@allowed([
  'westeurope'
  'centralus'
  'eastus2'
  'westus2'
  'eastasia'
])
param swaLocation string = 'eastus2'

@description('APIM publisher e-mail. Supplied at deploy time; never committed.')
param publisherEmail string

@description('APIM publisher name.')
param publisherName string = 'Jev on APIM sample'

@description('Jev API key. Supplied at deploy time from a GitHub secret; stored only in Key Vault.')
@secure()
param jevApiKey string

@description('Jev upstream base URL.')
param jevBackendUrl string = 'https://jevmodel.org/v1'

@description('Owner tag value.')
param owner string = 'jev-on-apim'

@description('Cost center tag value.')
param costCenter string = 'sample'

var suffix = substring(uniqueString(resourceGroup().id), 0, 6)
var baseName = '${workload}-${environmentName}'
var tags = {
  env: environmentName
  workload: workload
  owner: owner
  costCenter: costCenter
  dataClassification: 'internal'
}

resource apimIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${baseName}-apim-${suffix}'
  location: location
  tags: tags
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    logAnalyticsName: 'log-${baseName}-${suffix}'
    appInsightsName: 'appi-${baseName}-${suffix}'
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    keyVaultName: take('kv-${workload}-${environmentName}-${suffix}', 24)
    jevApiKey: jevApiKey
    readerPrincipalId: apimIdentity.properties.principalId
    tags: tags
  }
}

module apim 'modules/apim.bicep' = {
  name: 'apim'
  params: {
    location: location
    apimName: 'apim-${baseName}-${suffix}'
    publisherEmail: publisherEmail
    publisherName: publisherName
    identityId: apimIdentity.id
    identityClientId: apimIdentity.properties.clientId
    jevSecretUri: keyVault.outputs.jevSecretVersionlessUri
    jevBackendUrl: jevBackendUrl
    appInsightsId: monitoring.outputs.appInsightsId
    tags: tags
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp'
  params: {
    location: swaLocation
    swaName: 'swa-${baseName}-${suffix}'
    apimName: apim.outputs.apimName
    apimSubscriptionName: apim.outputs.webSubscriptionName
    apimGatewayUrl: apim.outputs.gatewayUrl
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    tags: union(tags, { 'azd-service-name': 'web' })
  }
}

output apimName string = apim.outputs.apimName
output apimGatewayUrl string = apim.outputs.gatewayUrl
output swaName string = staticWebApp.outputs.swaName
output swaDefaultHostname string = staticWebApp.outputs.defaultHostname
output keyVaultName string = keyVault.outputs.keyVaultName
