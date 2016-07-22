app.factory('MainFactory', function($http, SERVER) {

  const baseUrl = SERVER.baseUrl + '/api/chrome/';

  return {

    fetchTopics: function() {
      return $http.get(baseUrl + 'topics')
      .then(res => res.data);
    },

    fetchPlans: function(userId) {
      return $http.get(baseUrl + 'plans/user/' + userId)
      .then(res => res.data);
    },

    // resourceDetails = object with url, title, topicName
    submitResource: function(resourceDetails) {
      return $http.post(baseUrl + 'resource', resourceDetails);
    },

    getCurrentSite: function() {
      var queryInfo = {
        active: true,
        currentWindow: true
      };

      return new Promise( function(resolve) {
        chrome.tabs.query(queryInfo, function(tabs) {
          // chrome.tabs.query invokes the callback with a list of tabs that match the
          // query. When the popup is opened, there is certainly a window and at least
          // one tab, so we can safely assume that |tabs| is a non-empty array.
          // A window can only have one active tab at a time, so the array consists of
          // exactly one tab.
          var tab = tabs[0];

          // A tab is a plain object that provides information about the tab.
          // See https://developer.chrome.com/extensions/tabs#type-Tab
          var url = tab.url,
              title = tab.title;

          resolve({
            url: url,
            title: title
          });
        });
      });
    },

  }

});
