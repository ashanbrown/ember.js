import { get } from "ember-metal/property_get";
import run from "ember-metal/run_loop";
import copy from "ember-runtime/copy";
import EmberObject from "ember-runtime/system/object";
import AutoLocation from "ember-routing/location/auto_location";
import EmberLocation from "ember-routing/location/api";
import { supportsHistory, supportsHashChange } from "ember-routing/location/feature_detect";

var AutoTestLocation, location;

var FakeHistoryLocation = EmberObject.extend({
  implementation: 'history'
});

var FakeHashLocation = EmberObject.extend({
  implementation: 'hash'
});

var FakeNoneLocation = EmberObject.extend({
  implementation: 'none'
});

function createLocation(options) {
  if (!options) { options = {}; }

  if ('history' in options) {
    AutoTestLocation._getSupportsHistory = function() {
      return options.history;
    };
  }

  if ('hashChange' in options) {
    AutoTestLocation._getSupportsHashChange = function() {
      return options.hashChange;
    };
  }

  location = AutoTestLocation.create(options);
}

QUnit.module("Ember.AutoLocation", {
  setup: function() {
    AutoTestLocation = copy(AutoLocation);

    AutoTestLocation._HistoryLocation = FakeHistoryLocation;
    AutoTestLocation._HashLocation = FakeHashLocation;
    AutoTestLocation._NoneLocation = FakeNoneLocation;

    AutoTestLocation._location = {
      href: 'http://test.com/',
      pathname: '/',
      hash: '',
      search: '',
      replace: function () {
        ok(false, 'location.replace should not be called during testing');
      }
    };

    AutoTestLocation._history = {
      pushState: function () {
        ok(false, 'history.pushState should not be called during testing');
      },
      replaceState: function () {
        ok(false, 'history.replaceState should not be called during testing');
      }
    };
  },

  teardown: function() {
    run(function() {
      if (location && location.destroy) { location.destroy(); }
      location = AutoTestLocation = null;
    });
  }
});

test("_replacePath cannot be used to redirect to a different origin (website)", function() {
  expect(1);

  var expectedURL;

  AutoTestLocation._location = {
    protocol: 'http:',
    hostname: 'emberjs.com',
    port: '1337',

    replace: function (url) {
      equal(url, expectedURL);
    }
  };

  expectedURL = 'http://emberjs.com:1337//google.com';
  AutoTestLocation._replacePath('//google.com');
});

test("AutoLocation.create() should return a HistoryLocation instance when pushStates are supported", function() {
  expect(2);

  createLocation({
    history: true,
    hashChange: true
  });

  equal(get(location, 'implementation'), 'history');
  equal(location instanceof FakeHistoryLocation, true);
});

test("AutoLocation.create() should return a HashLocation instance when pushStates are not supported, but hashchange events are and the URL is already in the HashLocation format", function() {
  expect(2);

  AutoTestLocation._location.hash = '#/testd';

  createLocation({
    history: false,
    hashChange: true
  });

  equal(get(location, 'implementation'), 'hash');
  equal(location instanceof FakeHashLocation, true);
});

test("AutoLocation.create() should return a NoneLocation instance when neither history nor hashchange is supported.", function() {
  expect(2);

  AutoTestLocation._location.hash = '#/testd';

  createLocation({
    history: false,
    hashChange: false
  });

  equal(get(location, 'implementation'), 'none');
  equal(location instanceof FakeNoneLocation, true);
});

test("AutoLocation.create() should consider an index path (i.e. '/\') without any location.hash as OK for HashLocation", function() {
  expect(2);

  AutoTestLocation._location = {
    href: 'http://test.com/',
    pathname: '/',
    hash: '',
    search: '',
    replace: function (path) {
      ok(false, 'location.replace should not be called');
    }
  };

  createLocation({
    history: false,
    hashChange: true
  });

  equal(get(location, 'implementation'), 'hash');
  equal(location instanceof FakeHashLocation, true);
});

test("Feature-detecting the history API", function() {
  equal(supportsHistory("", { pushState: true }), true, "returns true if not Android Gingerbread and history.pushState exists");
  equal(supportsHistory("", {}), false, "returns false if history.pushState doesn't exist");
  equal(supportsHistory("", undefined), false, "returns false if history doesn't exist");
  equal(supportsHistory("Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; HTC Vision Build/GRI40) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1", { pushState: true }),
                        false, "returns false if Android Gingerbread stock browser claiming to support pushState");
});

test("AutoLocation.create() should transform the URL for hashchange-only browsers viewing a HistoryLocation-formatted path", function() {
  expect(4);

  AutoTestLocation._location = {
    hash: '',
    hostname: 'test.com',
    href: 'http://test.com/test',
    pathname: '/test',
    protocol: 'http:',
    port: '',
    search: '',

    replace: function (path) {
      equal(path, 'http://test.com/#/test', 'location.replace should be called with normalized HashLocation path');
    }
  };

  createLocation({
    history: false,
    hashChange: true
  });

  equal(get(location, 'implementation'), 'none', 'NoneLocation should be returned while we attempt to location.replace()');
  equal(location instanceof FakeNoneLocation, true, 'NoneLocation should be returned while we attempt to location.replace()');
  equal(get(location, 'cancelRouterSetup'), true, 'cancelRouterSetup should be set so the router knows.');
});

if (Ember.FEATURES.isEnabled('ember-routing-auto-location-uses-replace-state-for-history')) {
  test("AutoLocation.create() should replace the URL for pushState-supported browsers viewing a HashLocation-formatted url", function() {
    expect(2);

    AutoTestLocation._location = {
      hash: '#/test',
      hostname: 'test.com',
      href: 'http://test.com/#/test',
      pathname: '/',
      protocol: 'http:',
      port: '',
      search: ''
    };

    AutoTestLocation._history.replaceState = function (state, title, path) {
      equal(path, '/test', 'history.replaceState should be called with normalized HistoryLocation url');
    };

    createLocation({
      history: true,
      hashChange: true
    });

    equal(get(location, 'implementation'), 'history');
  });
} else {
  test("AutoLocation.create() should transform the URL for pushState-supported browsers viewing a HashLocation-formatted url", function() {
    expect(4);

    AutoTestLocation._location = {
      hash: '#/test',
      hostname: 'test.com',
      href: 'http://test.com/#/test',
      pathname: '/',
      protocol: 'http:',
      port: '',
      search: '',

      replace: function (path) {
        equal(path, 'http://test.com/test', 'location.replace should be called with normalized HistoryLocation url');
      }
    };

    createLocation({
      history: true,
      hashChange: true
    });

    equal(get(location, 'implementation'), 'none', 'NoneLocation should be returned while we attempt to location.replace()');
    equal(location instanceof FakeNoneLocation, true, 'NoneLocation should be returned while we attempt to location.replace()');
    equal(get(location, 'cancelRouterSetup'), true, 'cancelRouterSetup should be set so the router knows.');
  });
}

test("Feature-Detecting onhashchange", function() {
  equal(supportsHashChange(undefined, { onhashchange: function() {} }), true, "When not in IE, use onhashchange existence as evidence of the feature");
  equal(supportsHashChange(undefined, { }), false, "When not in IE, use onhashchange absence as evidence of the feature absence");
  equal(supportsHashChange(7, { onhashchange: function() {} }), false, "When in IE7 compatibility mode, never report existence of the feature");
  equal(supportsHashChange(8, { onhashchange: function() {} }), true, "When in IE8+, use onhashchange existence as evidence of the feature");
});

test("AutoLocation._getPath() should normalize location.pathname, making sure it always returns a leading slash", function() {
  expect(2);

  AutoTestLocation._location = { pathname: 'test' };
  equal(AutoTestLocation._getPath(), '/test', 'When there is no leading slash, one is added.');

  AutoTestLocation._location = { pathname: '/test' };
  equal(AutoTestLocation._getPath(), '/test', 'When a leading slash is already there, it isn\'t added again');
});

test("AutoLocation._getHash() should be an alias to Ember.Location._getHash, otherwise it needs its own test!", function() {
  expect(1);

  equal(AutoTestLocation._getHash, EmberLocation._getHash);
});

test("AutoLocation._getQuery() should return location.search as-is", function() {
  expect(1);

  AutoTestLocation._location = { search: '?foo=bar' };
  equal(AutoTestLocation._getQuery(), '?foo=bar');
});

test("AutoLocation._getFullPath() should return full pathname including query and hash", function() {
  expect(1);

  AutoTestLocation._location = {
    href: 'http://test.com/about?foo=bar#foo',
    pathname: '/about',
    search: '?foo=bar',
    hash: '#foo'
  };

  equal(AutoTestLocation._getFullPath(), '/about?foo=bar#foo');
});

test("AutoLocation._getHistoryPath() should return a normalized, HistoryLocation-supported path", function() {
  expect(3);

  AutoTestLocation.rootURL = '/app/';

  AutoTestLocation._location = {
    href: 'http://test.com/app/about?foo=bar#foo',
    pathname: '/app/about',
    search: '?foo=bar',
    hash: '#foo'
  };
  equal(AutoTestLocation._getHistoryPath(), '/app/about?foo=bar#foo', 'URLs already in HistoryLocation form should come out the same');

  AutoTestLocation._location = {
    href: 'http://test.com/app/#/about?foo=bar#foo',
    pathname: '/app/',
    search: '',
    hash: '#/about?foo=bar#foo'
  };
  equal(AutoTestLocation._getHistoryPath(), '/app/about?foo=bar#foo', 'HashLocation formed URLs should be normalized');

  AutoTestLocation._location = {
    href: 'http://test.com/app/#about?foo=bar#foo',
    pathname: '/app/',
    search: '',
    hash: '#about?foo=bar#foo'
  };
  equal(AutoTestLocation._getHistoryPath(), '/app/#about?foo=bar#foo', 'URLs with a hash not following #/ convention shouldn\'t be normalized as a route');
});

test("AutoLocation._getHashPath() should return a normalized, HashLocation-supported path", function() {
  expect(3);

  AutoTestLocation.rootURL = '/app/';

  AutoTestLocation._location = {
    href: 'http://test.com/app/#/about?foo=bar#foo',
    pathname: '/app/',
    search: '',
    hash: '#/about?foo=bar#foo'
  };
  equal(AutoTestLocation._getHashPath(), '/app/#/about?foo=bar#foo', 'URLs already in HistoryLocation form should come out the same');

  AutoTestLocation._location = {
    href: 'http://test.com/app/about?foo=bar#foo',
    pathname: '/app/about',
    search: '?foo=bar',
    hash: '#foo'
  };
  equal(AutoTestLocation._getHashPath(), '/app/#/about?foo=bar#foo', 'HistoryLocation formed URLs should be normalized');

  AutoTestLocation._location = {
    href: 'http://test.com/app/#about?foo=bar#foo',
    pathname: '/app/',
    search: '',
    hash: '#about?foo=bar#foo'
  };

  equal(AutoTestLocation._getHashPath(), '/app/#/#about?foo=bar#foo', 'URLs with a hash not following #/ convention shouldn\'t be normalized as a route');
});

test("AutoLocation.create requires any rootURL given to end in a trailing forward slash", function() {
  expect(3);

  var expectedMsg = /rootURL must end with a trailing forward slash e.g. "\/app\/"/;

  expectAssertion(function() {
    createLocation({ rootURL: 'app' });
  }, expectedMsg);

  expectAssertion(function() {
    createLocation({ rootURL: '/app' });
  }, expectedMsg);

  expectAssertion(function() {
    // Note the trailing whitespace
    createLocation({ rootURL: '/app/ ' });
  }, expectedMsg);
});
