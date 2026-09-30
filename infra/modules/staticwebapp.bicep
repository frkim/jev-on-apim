@description('Azure region for Static Web Apps (limited list: westeurope, centralus, eastus2, westus2, eastasia).')
param location string

@description('Static Web App name.')
param swaName string

@description('APIM service name that fronts Jev.')
param apimName string

@description('APIM subscription (for the web studio) whose key is given to the managed Functions API.')
param apimSubscriptionName string

@description('APIM gateway base URL.')
param apimGatewayUrl string

@description('Application Insights connection string for the managed Functions API.')
param appInsightsConnectionString string

@description('Resource tags.')
param tags object

resource apim 'Microsoft.ApiManagement/service@2024-05-01' existing = {
  name: apimName
}

resource apimSubscription 'Microsoft.ApiManagement/service/subscriptions@2024-05-01' existing = {
  parent: apim
  name: apimSubscriptionName
}

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

resource appSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    APIM_GATEWAY_URL: apimGatewayUrl
    APIM_SUBSCRIPTION_KEY: apimSubscription.listSecrets().primaryKey
    JEV_MOCK_MODE: 'false'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
  }
}

output swaName string = swa.name
output defaultHostname string = swa.properties.defaultHostname
