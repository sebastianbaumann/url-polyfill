const assert = require('assert'),
  test = require('selenium-webdriver/testing'),
  webdriver = require('selenium-webdriver');


Promise.sequence = (promiseFactories) => {
  let promise = Promise.resolve();
  promiseFactories.forEach((promiseFactory) => {
    promise = promise.then(() => {
      promiseFactory();
    });
  });
  return promise;
};

Promise.parallel = (promiseFactories) => {
  let promises = [];
  promiseFactories.forEach(promiseFactory => {
    promises.push(promiseFactory());
  });
  return Promise.all(promises);
};

class Tester {
  static get CHROME () { return 'chrome' };
  static get FIREFOX () { return 'firefox' };
  static get OPERA () { return 'opera' };
  static get IE () { return 'ie' };


  constructor(remoteUrl) {
    this.remoteUrl = remoteUrl;
  }

  testWith(browsers, callback) {
    let drivers = browsers.map((browser) => this.getBrowserDriver(browser));
    let promiseFactories = [];
    for(let i = 0; i < drivers.length; i++) {
      promiseFactories.push(() => {
        return this.testWithDriver(drivers[i], callback);
      });
    }
    return Promise.parallel(promiseFactories);
  }

  testWithDriver(driver, callback) {
    return new Promise((resolve, reject) => {
      callback(driver, resolve);
    });
  }

  getBrowserDriver(browserName) {
    let capabilities = null;

    switch(browserName) {
      case Tester.CHROME:
        capabilities = webdriver.Capabilities.chrome();
        break;
      case Tester.IE:
        capabilities = webdriver.Capabilities.ie();
        break;
      case Tester.FIREFOX:
        capabilities = webdriver.Capabilities.firefox();
        break;
      case Tester.OPERA:
        capabilities = webdriver.Capabilities.opera();
        break;
      default:
        throw new Error('Can\'t find browswer name ' + browserName);
      // return null;
    }

    return new webdriver.Builder()
      .usingServer(this.remoteUrl)
      .withCapabilities(capabilities)
      .build();
  }

  navigate(driver, path) {
    return driver.executeScript('return window.router.navigate(' + JSON.stringify(path) + ');');
  }

  executeScript(driver, script) {
    return this.executeAsyncScript(driver, `resolve(
      (function() {
        ${script}
      })()
    );`);
  }

  executeAsyncScript(driver, script) {
    return driver.executeAsyncScript(`
     var __done = arguments[arguments.length - 1];
     var resolve = function(data) {
      __done({ success : true, data: data });
     };
     var reject = function(error) {
      __done({ success : false, error: error });
     };
     
     try {
      ${script}
     } catch(error) {
      reject(error);
     }
    `).then((data) => {
      if(data.success) {
        return data.data;
      } else {
        throw new Error(data.error.description + '\n\n' + data.error.stack);
      }
    });
  }

  untilIsNotVisible(element) {
    return () => {
      return element.isDisplayed().then(() => false).catch(() => true);
    };
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }
}

const config = require('./config.json');
const tester = new Tester(config.testServer);


test.describe('URL polyfill', function() {
  this.timeout(30000);

  tester.testWith([
    Tester.CHROME,
    //Tester.FIREFOX,
    //Tester.OPERA,
    Tester.IE
  ], (driver, done) => {
    driver.manage().timeouts().setScriptTimeout(15000);


    test.before(() => {
      driver.manage().timeouts().pageLoadTimeout(1000);
       driver.navigate().to(config.testHost);
      return tester.sleep(2000);
    });

    test.it('Test URL', () => {
      return tester.executeScript(driver, `
        var url = new URL('https://www.yahoo.com:80/?fr=yset_ie_syc_oracle&type=orcl_hpset#page0');
        
        if(url.hash !== '#page0') throw new Error('Invalid hash : ' + url.hash);
        if(url.host !== 'www.yahoo.com:80') throw new Error('Invalid host : ' + url.host);
        if(url.hostname !== 'www.yahoo.com') throw new Error('Invalid hostname : ' + url.hostname);
        if(url.href !== 'https://www.yahoo.com:80/?fr=yset_ie_syc_oracle&type=orcl_hpset#page0') throw new Error('Invalid href : ' + url.href);
        if(url.origin !== 'https://www.yahoo.com:80') throw new Error('Invalid origin : ' + url.origin);
        if(url.pathname !== '/') throw new Error('Invalid pathname : ' + url.pathname);
        if(url.port !== '80') throw new Error('Invalid port : ' + url.port);
        if(url.protocol !== 'https:') throw new Error('Invalid protocol : ' + url.protocol);
        if(url.search !== '?fr=yset_ie_syc_oracle&type=orcl_hpset') throw new Error('Invalid search : ' + url.search);
        
        url.searchParams.append('page', 1);
        if(url.search !== '?fr=yset_ie_syc_oracle&type=orcl_hpset&page=1') throw new Error('Invalid search (append page 1) : ' + url.search);
        
        url.searchParams.delete('type')
        if(url.search !== '?fr=yset_ie_syc_oracle&page=1') throw new Error('Invalid search (delete type) : ' + url.search);
        
        return url;
      `)/*.then((data) => {
        console.log(data);
      })*/;
    });


    test.after(() => {
      driver.quit();
      done();
    });
  });
});

