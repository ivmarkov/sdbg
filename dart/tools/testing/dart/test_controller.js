// Copyright (c) 2011, the Dart project authors.  Please see the AUTHORS file
// for details. All rights reserved. Use of this source code is governed by a
// BSD-style license that can be found in the LICENSE file.

/**
 * Test controller logic - used by unit test harness to embed tests in
 * conent shell.
 */

/*
 * We will collect testing driver specific events here instead of printing
 * them to the DOM.
 * Every entry will look like this:
 *   {
 *     'type' : 'sync_exception' / 'window_onerror' / 'script_onerror' / 'print'
 *              'window_compilationerror' / 'message_received' / 'dom' / 'debug'
 *     'value' : 'some content',
 *     'timestamp' : TimestampInMs,
 *   }
 */
var recordedEventList = [];
var timestampOfFirstEvent = null;

function getCurrentTimestamp() {
  if (timestampOfFirstEvent == null) {
    timestampOfFirstEvent = new Date().getTime();
  }
  return (new Date().getTime() - timestampOfFirstEvent) / 1000.0;
}

function stringifyEvent(event) {
  return JSON.stringify(event, null, 2);
}

function recordEvent(type, value) {
  var event = {
    type: type,
    value: value,
    timestamp: getCurrentTimestamp()
  };
  recordedEventList.push(event);
  printToConsole(stringifyEvent(event));
}

function clearConsole() {
  // Clear the console before every test run - this is Firebug specific code.
  if (typeof console == 'object' && typeof console.clear == 'function') {
    console.clear();
  }
}

function printToDOM(message) {
  var pre = document.createElement('pre');
  pre.appendChild(document.createTextNode(String(message)));
  document.body.appendChild(pre);
  document.body.appendChild(document.createTextNode('\n'));
}

function printToConsole(message) {
  var consoleAvailable = typeof console === 'object';

  if (!consoleAvailable) {
    printToDOM(message);
  } else {
    console.log(message);
  }
}

clearConsole();

// Some tests may expect and have no way to suppress global errors.
var testExpectsGlobalError = false;
var testSuppressedGlobalErrors = [];

// Set window onerror to make sure that we catch test harness errors across all
// browsers.
window.onerror = function (message, url, lineNumber) {
  if (url) {
    message = ('window.onerror called: \n\n' +
        url + ':' + lineNumber + ':\n' + message + '\n\n');
  }
  if (testExpectsGlobalError) {
    testSuppressedGlobalErrors.push({
      message: message
    });
    return;
  }
  recordEvent('window_onerror', message);
  notifyDone('FAIL');
};

// testRunner is provided by content shell.
// It is not available in browser tests.
var testRunner = window.testRunner || window.layoutTestController;
var isContentShell = testRunner;

var waitForDone = false;

// Returns the driving window object if available
function getDriverWindow() {
  if (window != window.parent) {
    // We're running in an iframe.
    return window.parent;
  } else if (window.opener) {
    // We were opened by another window.
    return window.opener;
  }
  return null;
}

function usingBrowserController() {
  return getDriverWindow() != null;
}

function notifyStart() {
  recordEvent('debug', 'test_controller.js started');
  var driver = getDriverWindow();
  if (driver) {
    driver.postMessage('STARTING', '*');
  }
}
// We call notifyStart here to notify the encapsulating browser.
notifyStart();

function notifyDone(test_outcome) {
  // If we are not using the browser controller (e.g. in the none-drt
  // configuration), we need to print 'test_outcome' as it is.
  if (!usingBrowserController()) {
    if (isContentShell) {
      // We need this, since test.dart is looking for 'FAIL\n', 'PASS\n' in the
      // DOM output of content shell.
      printToDOM(test_outcome);
    } else {
      printToConsole('Test outcome: ' + test_outcome);
    }
  } else {
    // To support in browser launching of tests we post back start and result
    // messages to the window.opener.
    var driver = getDriverWindow();

    // Post the DOM and all events that happened.
    var events = recordedEventList.slice(0);
    events.push({
      type: 'dom',
      value: '' + window.document.documentElement.innerHTML,
      timestamp: getCurrentTimestamp()
    });

    driver.postMessage(JSON.stringify(events), '*');
  }
  if (testRunner) testRunner.notifyDone();
}

function processMessage(msg) {
  // Filter out ShadowDOM polyfill messages which are random floats.
  if (msg != parseFloat(msg)) {
    recordEvent('message_received', '' + msg);
  }
  if (typeof msg != 'string') return;
  if (msg == 'unittest-suite-wait-for-done') {
    waitForDone = true;
    if (testRunner) {
      testRunner.startedDartTest = true;
    }
  } else if (msg == 'dart-calling-main') {
    if (testRunner) {
      testRunner.startedDartTest = true;
    }
  } else if (msg == 'dart-main-done') {
    if (!waitForDone) {
      notifyDone('PASS');
    }
  } else if (msg == 'unittest-suite-success' ||
             msg == 'unittest-suite-done') {
    notifyDone('PASS');
  } else if (msg == 'unittest-suite-fail') {
    notifyDone('FAIL');
  }
}

function onReceive(e) {
  processMessage(e.data);
}

if (testRunner) {
  testRunner.dumpAsText();
  testRunner.waitUntilDone();
}
window.addEventListener('message', onReceive, false);

function onLoad(e) {
  // needed for dartium compilation errors.
  if (window.compilationError) {
    recordEvent('window_compilationerror',
        'DOMContentLoaded event: window.compilationError = ' +
        calledwindow.compilationError);
    notifyDone('FAIL');
  }
}

window.addEventListener('DOMContentLoaded', onLoad, false);

// Note: before renaming this function, note that it is also included in an
// inlined error handler in the HTML files that wrap DRT tests.
// See: tools/testing/dart/browser_test.dart
function scriptTagOnErrorCallback(e) {
  var message = e && e.message;
  recordEvent('script_onerror', 'script.onError called: ' + message);
  notifyDone('FAIL');
}

// dart2js will generate code to call this function to handle the Dart
// [print] method.
//
// dartium will invoke this method for [print] calls if the environment variable
// "DART_FORWARDING_PRINT" was set when launching dartium.
//
// Our tests will be wrapped, so we can detect when [main] is called and when
// it has ended.
// The wrapping happens either via "dartMainRunner" (for dart2js) or wrapped
// tests for dartium.
//
// The following messages are handled specially:
//   dart-calling-main:  signals that the dart [main] function will be invoked
//   dart-main-done:  signals that the dart [main] function has finished
//   unittest-suite-wait-for-done:  signals the start of an asynchronous test
//   unittest-suite-success:  signals the end of an asynchrounous test
//   unittest-suite-fail:  signals that the asynchronous test failed
//   unittest-suite-done:  signals the end of an asynchronous test, the outcome
//                         is unknown
//
// These messages are used to communicate with the test and will be posted so
// [processMessage] above can see it.
function dartPrint(message) {
  recordEvent('print', message);
  if ((message === 'unittest-suite-wait-for-done') ||
      (message === 'unittest-suite-success') ||
      (message === 'unittest-suite-fail') ||
      (message === 'unittest-suite-done') ||
      (message === 'dart-calling-main') ||
      (message === 'dart-main-done')) {
    // We have to do this asynchronously, in case error messages are
    // already in the message queue.
    window.postMessage(message, '*');
    return;
  }
}

// dart2js will generate code to call this function instead of calling
// Dart [main] directly. The argument is a closure that invokes main.
function dartMainRunner(main) {
  dartPrint('dart-calling-main');
  try {
    main();
  } catch (e) {
    recordEvent('sync_exception', 'Exception: ' + e + '\nStack: ' + e.stack);
    notifyDone('FAIL');
    return;
  }
  dartPrint('dart-main-done');
}