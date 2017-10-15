import { Platform, Alert, Linking } from 'react-native'

import * as StoreReview from 'react-native-store-review'
import RatingsData from './RatingsData'

const _config = {
}

const parsedConfig = (appName) => ({
  rateTitle: `Rate ${appName}?`,
  ratePrompt: `We're glad you love ${appName}! Please take a moment to rate your experience.  Thank you so much!`,
  appStoreId: null,
  actionLabels: {
    decline: 'No, Thanks',
    delay: 'Maybe Later',
    feedback: 'I Will',
    accept: `Rate ${appName}`
  },
  timingFunction: function (currentCount) {
    return currentCount > 5 && (Math.log(currentCount) / Math.log(3)).toFixed(4) % 1 === 0
  }
})

async function _isAwaitingRating () {
  let timestamps = await RatingsData.getActionTimestamps()

  // If no timestamps have been set yet we are still awaiting the user, return true
  return timestamps.every((timestamp) => { return timestamp[1] === null })
}

/**
 * Creates the RatingRequestor object you interact with
 * @class
 */
export default class RatingRequestor {
  /**
   * @param  {string} appStoreId - Required. The ID used in the app's respective app store
   * @param  {object} options - Optional. Override the defaults. Takes the following shape, with all elements being optional:
   *                 {
   *                   title: {string},
   *                   ratePrompt: {string},
   *                   initialQuestion: {string},
   *                   feedbackPrompt: {string},
   *                   actionLabels: {
   *                     decline: {string},
   *                     delay: {string},
   *                     accept: {string}
   *                     feedback: {string}
   *                   },
   *                   timingFunction: {func}
   *                 }
   */
  constructor (appStoreId, appName, options) {
    // Check for required options
    if (!appStoreId) {
      throw new Error('You must specify your app\'s store ID on construction to use the Rating Requestor.')
    }

    // Merge defaults with user-supplied config
    Object.assign(_config, parsedConfig(appName), options)
    _config.appStoreId = appStoreId
  }

  /**
   * For debug purposes
   */
  resetData () {
    RatingsData.resetData()
  }

  /**
   * Immediately invoke the store review
   */
  storeReview (cbFunction = () => { }) {
    let storeUrl = Platform.OS === 'ios'
      ? `https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=${_config.appStoreId}&pageNumber=0&sortOrdering=2&type=Purple+Software&mt=8`
      : `market://details?id=${_config.appStoreId}`

    RatingsData.recordRated()
    cbFunction(true, 'accept')

    // This API is only available on iOS 10.3 or later
    if (Platform.OS === 'ios' && StoreReview.isAvailable) {
      StoreReview.requestReview()
    } else {
      Linking.openURL(storeUrl)
    }
  }

  showInitialDialog (cbFunction = () => { }) {
    Alert.alert(
      _config.rateTitle,
      _config.ratePrompt,
      [
        { text: _config.actionLabels.accept, onPress: () => this.storeReview() },
        { text: _config.actionLabels.delay, onPress: () => { cbFunction(true, 'delay') } },
        { text: _config.actionLabels.decline, onPress: () => { RatingsData.recordDecline(); cbFunction(true, 'decline') } }
      ]
    )
  }

  /**
   * Call when a positive interaction has occurred within your application. Depending on the number
   * of times this has occurred and your timing function, this may display a rating request dialog.
   *
   * @param {function(didAppear: boolean, result: string)} cbFunction Optional. cbFunction that reports whether the dialog appeared and what the result was.
   */
  async handlePositiveEvent (cbFunction = () => { }) {
    if (await _isAwaitingRating()) {
      let currentCount = await RatingsData.incrementCount()

      if (_config.timingFunction(currentCount)) {
        this.showInitialDialog(cbFunction)
      } else {
        cbFunction(false)
      }
    } else {
      cbFunction(false)
    }
  }
}
