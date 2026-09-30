@description('Azure region.')
param location string

@description('API Management service name.')
param apimName string

@description('Publisher e-mail (required by API Management).')
param publisherEmail string

@description('Publisher display name.')
param publisherName string

@description('Resource id of the user-assigned identity used to read Key Vault.')
param identityId string

@description('Client id of the user-assigned identity used to read Key Vault.')
param identityClientId string

@description('Versionless Key Vault secret URI holding the Jev API key.')
param jevSecretUri string

@description('Jev upstream base URL.')
param jevBackendUrl string = 'https://jevmodel.org/v1'

@description('Application Insights resource id (for the APIM logger).')
param appInsightsId string

@description('Resource tags.')
param tags object

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: last(split(appInsightsId, '/'))
}

resource apim 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: apimName
  location: location
  tags: tags
  sku: {
    name: 'Consumption'
    capacity: 0
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

resource jevKey 'Microsoft.ApiManagement/service/namedValues@2024-05-01' = {
  parent: apim
  name: 'jev-api-key'
  properties: {
    displayName: 'jev-api-key'
    secret: true
    keyVault: {
      secretIdentifier: jevSecretUri
      identityClientId: identityClientId
    }
  }
}

resource backend 'Microsoft.ApiManagement/service/backends@2024-05-01' = {
  parent: apim
  name: 'jevmodel'
  properties: {
    title: 'Jev System One (jevmodel.org)'
    description: 'TypeSafe Jev System One decision model'
    protocol: 'http'
    url: jevBackendUrl
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

resource api 'Microsoft.ApiManagement/service/apis@2024-05-01' = {
  parent: apim
  name: 'jev'
  properties: {
    displayName: 'Jev System One'
    description: 'Evaluate typed questions (noul, choice, score) over a state with the Jev model.'
    path: 'jev/v1'
    protocols: [
      'https'
    ]
    serviceUrl: jevBackendUrl
    subscriptionRequired: true
    subscriptionKeyParameterNames: {
      header: 'Ocp-Apim-Subscription-Key'
      query: 'subscription-key'
    }
    apiType: 'http'
  }
}

resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2024-05-01' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: loadTextContent('../policies/jev-api.xml')
  }
  dependsOn: [
    jevKey
    backend
  ]
}

resource systemOneOperation 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'systemone'
  properties: {
    displayName: 'System One - answer questions'
    method: 'POST'
    urlTemplate: '/systemone'
    description: 'Answers noul / choice / score questions about a state.'
    request: {
      representations: [
        {
          contentType: 'application/json'
        }
      ]
    }
    responses: [
      {
        statusCode: 200
        representations: [
          {
            contentType: 'application/json'
          }
        ]
      }
    ]
  }
}

resource healthOperation 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'health'
  properties: {
    displayName: 'Gateway health'
    method: 'GET'
    urlTemplate: '/health'
    description: 'Answered by APIM without calling the Jev backend.'
  }
}

resource healthPolicy 'Microsoft.ApiManagement/service/apis/operations/policies@2024-05-01' = {
  parent: healthOperation
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: loadTextContent('../policies/jev-health.xml')
  }
  dependsOn: [
    apiPolicy
  ]
}

resource product 'Microsoft.ApiManagement/service/products@2024-05-01' = {
  parent: apim
  name: 'jev-evaluation'
  properties: {
    displayName: 'Jev Evaluation'
    description: 'Access to the Jev System One API for the evaluation studio.'
    subscriptionRequired: true
    approvalRequired: false
    state: 'published'
  }
}

resource productApi 'Microsoft.ApiManagement/service/products/apis@2024-05-01' = {
  parent: product
  name: api.name
}

resource webSubscription 'Microsoft.ApiManagement/service/subscriptions@2024-05-01' = {
  parent: apim
  name: 'jev-web-studio'
  properties: {
    displayName: 'Jev Evaluation Studio (web)'
    scope: product.id
    state: 'active'
    allowTracing: false
  }
  dependsOn: [
    productApi
  ]
}

resource logger 'Microsoft.ApiManagement/service/loggers@2024-05-01' = {
  parent: apim
  name: 'appinsights'
  properties: {
    loggerType: 'applicationInsights'
    resourceId: appInsights.id
    credentials: {
      connectionString: appInsights.properties.ConnectionString
    }
  }
}

resource apiDiagnostics 'Microsoft.ApiManagement/service/apis/diagnostics@2024-05-01' = {
  parent: api
  name: 'applicationinsights'
  properties: {
    loggerId: logger.id
    alwaysLog: 'allErrors'
    verbosity: 'information'
    httpCorrelationProtocol: 'W3C'
    sampling: {
      samplingType: 'fixed'
      percentage: 100
    }
    frontend: {
      request: {
        headers: [
          'x-correlation-id'
        ]
        body: {
          bytes: 0
        }
      }
      response: {
        headers: []
        body: {
          bytes: 0
        }
      }
    }
    backend: {
      request: {
        headers: []
        body: {
          bytes: 0
        }
      }
      response: {
        headers: [
          'retry-after'
        ]
        body: {
          bytes: 0
        }
      }
    }
  }
}

output apimName string = apim.name
output gatewayUrl string = apim.properties.gatewayUrl
output webSubscriptionName string = webSubscription.name
