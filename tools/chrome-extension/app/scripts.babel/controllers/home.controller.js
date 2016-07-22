app.controller('HomeCtrl', function($scope, topics, MainFactory, AuthService, $sce, SERVER, flash) {

  $scope.user = null;
  $scope.topics = topics;

  $scope.isLoggedIn = function () {
    return AuthService.isAuthenticated();
  };

  $scope.flashMsg = flash.getMessage();
  console.log($scope.flashMsg);

  var welcomeMessages = [
    'DO NOT AROUSE THE WRATH OF THE GREAT AND POWERFUL OZ!<br><br>Err, sorry, wrong gig.  I am the knowledgable and helpful Grok!',
    'A wizard is never late, nor is he early, he arrives precisely when he means to.<br><br>I am the knowledgable and helpful Grok, and you\'re in luck, because I meant to arrive just as you did.',
    'Do not take me for some conjuror of cheap tricks! I am not trying to rob you.<br><br>I\'m trying to help you.',
    'Nobody gets in to see the wizard, not nobody, not no how!<br><br>Except you, I like you.',
    'You should consider yourself lucky that I\'m granting you an audience tomorrow instead of 20 years from now.<br><br>Also, I don\'t really have much going on except helping you.',
    'Do not meddle in the affairs of Wizards, for they are subtle and quick to anger.<br><br>Except me of course, I\'m here to help.'
  ];

  $scope.getWelcomeMessage = function() {
    return $sce.trustAsHtml(welcomeMessages[ Math.floor(Math.random() * welcomeMessages.length)]);
  }

  var setUser = function () {
    AuthService.getLoggedInUser().then(function (user) {
      $scope.user = user;
    });
  };

  setUser();

  $scope.cloudWords = topics.map( function(topic) {
    return {
      text: topic.title,
      weight: Math.random()*10,
      link: SERVER.baseUrl + '/topic/' + topic.id
    }
  });

  // Add target="_blank" to word cloud
  $(document).ready(function(){
    $('#topicCloud').find('a').attr('target', '_blank');
  });

});
