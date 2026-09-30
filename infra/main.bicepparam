using './main.bicep'

param workload = 'jevapim'
param environmentName = 'dev'
// westeurope does not accept new resources for this subscription; swedencentral is used instead.
param location = readEnvironmentVariable('AZURE_LOCATION', 'swedencentral')
param swaLocation = readEnvironmentVariable('SWA_LOCATION', 'eastus2')
param publisherEmail = readEnvironmentVariable('APIM_PUBLISHER_EMAIL', 'apim-admin@example.com')
param jevApiKey = readEnvironmentVariable('JEV_API_KEY', '')
