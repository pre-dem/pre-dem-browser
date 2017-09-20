import { Dem } from '../dem'

import Source, { ISourceMessage } from '../source'
import { fill } from '../utils'
import { _window, _navigator, _document } from '../detection'

export interface IHistoryMessage extends ISourceMessage {
  payload: {
    from?: string
    to: string
    pageSize?: {
      width: number
      height: number
    }
    screenSize?: {
      width: number
      height: number
    }
    pageView?: boolean
    userAgent?: string
  }
}

export default (dem: Dem) => {
  if (!_window) return

  const _location = _window.location
  let _lastHref = _location && _location.href

  const chrome = _window.chrome
  const isChromePackagedApp = chrome && chrome.app && chrome.app.runtime
  const hasPushState = !isChromePackagedApp && _window.history && history.pushState

  if (!hasPushState) return

  return new Source<IHistoryMessage>('breadcrumb.history', (action) => {
    if (_window && _navigator && _document) {
      // Push a navigation message when page load
      const message: IHistoryMessage = {
        category: 'navigation',
        payload: {
          to: _lastHref,
          pageView: true,
          pageSize: {
            width: _document.body.offsetWidth,
            height: _document.body.offsetHeight
          },
          screenSize: {
            width: _window.screen.width,
            height: _window.screen.height
          },
          userAgent: _navigator.userAgent
        }
      }

      setTimeout(() => action(message), 1)
    }

    // TODO: remove onpopstate handler on uninstall()
    var oldOnPopState = _window.onpopstate;
    _window.onpopstate = function () {
      const currentHref = _location.href

      const message: IHistoryMessage = {
        category: 'navigation',
        payload: {
          to: currentHref,
          from: _lastHref
        }
      }

      action(message)

      _lastHref = currentHref

      if (oldOnPopState) {
        return oldOnPopState.apply(history, arguments)
      }
    }

    fill(history, 'pushState', (origPushState) => {

      return (...args) => {
        const url = args.length > 2 ? args[2] : undefined

        // url argument is optional
        if (url) {
          // coerce to string (this is what pushState does)
          const message: IHistoryMessage = {
            category: 'navigation',
            payload: {
              to: url,
              from: _lastHref
            }
          }

          action(message)

          _lastHref = url
        }

        return origPushState.apply(history, args)
      }
    }, dem.__wrappedBuiltins)
  })
}