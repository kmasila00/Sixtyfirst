app.factory('flash', function($rootScope) {
  var queue = [];
  var currentMessage = '';

  $rootScope.$on('$stateChangeStart', function() {
    currentMessage = queue.shift() || '';

  });

  return {
    setMessage: function(message) {
      queue.push(message);
    },
    getMessage: function() {
      return currentMessage;
    }
  };
});
