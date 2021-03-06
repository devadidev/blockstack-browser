
import hash from 'hash-handler'
import log4js from 'log4js'

const logger = log4js.getLogger('utils/api-utils.js')

import { uploadProfile, DROPBOX } from '../account/utils'
import { signProfileForUpload } from './index'

export function getNamesOwned(address, bitcoinAddressLookupUrl, callback) {
  const url = bitcoinAddressLookupUrl.replace('{address}', address)
  fetch(url)
    .then((response) => response.text())
    .then((responseText) => JSON.parse(responseText))
    .then((responseJson) => {
      callback([])
    })
    .catch((error) => {
      logger.error('getNamesOwned: error', error)
      callback([])
    })
}

export function authorizationHeaderValue(coreAPIPassword) {
  return `bearer ${coreAPIPassword}`
}

export function getCoreAPIPasswordFromURL() {
  const coreAPIPassword = hash.getInstance().get('coreAPIPassword')
  if (!coreAPIPassword || coreAPIPassword === 'off') {
    return null
  }
  hash.getInstance().set('coreAPIPassword', 'off')
  return coreAPIPassword
}

export function getLogServerPortFromURL() {
  const logServerPort = hash.getInstance().get('logServerPort')
  if (!logServerPort || logServerPort === 'off') {
    return null
  }
  hash.getInstance().set('logServerPort', 'off')
  return logServerPort
}

export function isCoreApiRunning(corePingUrl) {
  logger.debug(`isCoreApiRunning: ${corePingUrl}`)
  return new Promise((resolve) => {
    fetch(corePingUrl, { cache: 'no-store' })
    .then((response) => response.text())
    .then((responseText) => JSON.parse(responseText))
    .then((responseJson) => {
      if (responseJson.status === 'alive') {
        logger.trace('isCoreApiRunning? Yes!')
        resolve(true)
      } else {
        logger.error('isCoreApiRunning? No!')
        resolve(false)
      }
    })
    .catch((error) => {
      logger.error(`isCoreApiRunning: problem checking ${corePingUrl}`, error)
      resolve(false)
    })
  })
}

export function isApiPasswordValid(corePasswordProtectedReadUrl, coreApiPassword) {
  logger.debug(`isApiPasswordValid: ${corePasswordProtectedReadUrl}`)

  const requestHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: authorizationHeaderValue(coreApiPassword)
  }

  return new Promise((resolve) => {
    if (!coreApiPassword) {
      logger.error('isCoreApiPasswordValid? Password is missing!')
      resolve(false)
      return
    }
    fetch(corePasswordProtectedReadUrl, {
      cache: 'no-store',
      headers: requestHeaders
    })
    .then((response) => {
      if (response.ok) {
        logger.trace('isCoreApiPasswordValid? Yes!')
        resolve(true)
      } else {
        logger.error('isCoreApiPasswordValid? No!')
        resolve(false)
      }
    })
    .catch((error) => {
      logger.error(`isApiPasswordValid: problem checking ${corePasswordProtectedReadUrl}`,
        error)
      resolve(false)
    })
  })
}


/*
 * Insert storage driver routing information into a profile.
 * Existing routing information for this driver will be overwritten.
 *
 * TODO: this method will be rewritten/removed once Core knows about the token file
 *
 * Return the new profile.
 */
function profileInsertStorageRoutingInfo(profile, driverName, indexUrl) {
  if (!profile.account) {
    profile.account = []
  }

  for (let i = 0; i < profile.account.length; i++) {
    if (profile.account[i].identifier === 'storage' && profile.account[i].service === driverName) {
       // patch this instance
      profile.account[i].contentUrl = indexUrl
      return profile
    }
  }

   // not yet present
  const storageAccount = {
    identifier: 'storage',
    service: driverName,
    contentUrl: indexUrl
  }

  profile.account.push(storageAccount)
  return profile
}


/* Expects a JavaScript object with a key containing the config for each storage
 * provider
 * Example:
 * const config = { dropbox: { token: '123abc'} }
 */
export function setCoreStorageConfig(api,
  blockchainId = null, profile = null, profileSigningKeypair = null) {
  return new Promise((resolve, reject) => {

    // for now, we only support Dropbox
    if (api.hostedDataLocation !== DROPBOX) {
      throw new Error('Only support "dropbox" driver at this time')
    }

    const driverName = 'dropbox'

    const requestBody = { driver_config: { token: api.dropboxAccessToken } }
    const url = `http://localhost:6270/v1/node/drivers/storage/${driverName}?index=1`
    const bodyText = JSON.stringify(requestBody)

    const options = {
      method: 'POST',
      host: 'localhost',
      port: '6270',
      path: `/v1/node/drivers/storage/${driverName}?index=1`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyText.length,
        Authorization: authorizationHeaderValue(api.coreAPIPassword)
      },
      body: bodyText
    }

    return fetch(url, options)
    .then((response) => {
      if (response.status !== 200) {
        throw new Error(response.statusText)
      }
      return response.text()
        .then((responseText) => JSON.parse(responseText))
        .then((responseJson) => {
         // expect the index URL (for some drivers, like Dropbox)
          const driverConfigResult = responseJson

          if (driverConfigResult.index_url && profile && blockchainId) {
            // insert it into the profile and replicate it.
            profile = profileInsertStorageRoutingInfo(profile,
              driverName, driverConfigResult.index_url)
            const data = signProfileForUpload(profile, profileSigningKeypair)

            return uploadProfile(api, blockchainId, data)
            .then((result) => {
              // saved!
              resolve(result)
            })
            .catch((error) => {
              reject(error)
            })
          } else {
            // Some drivers won't return an indexUrl
            // or we'll want to initialize
            resolve('OK')
          }
        })
    })
    .catch((error) => {
      reject(error)
    })
  })
}
