app.config(function ($stateProvider, $urlRouterProvider) {

  $urlRouterProvider.otherwise('/');

  $stateProvider.state('home', {
    url: '/',
    templateUrl: 'views/home.html',
    controller: 'HomeCtrl',
    resolve: {
      topics: function(MainFactory) {
        return MainFactory.fetchTopics();
      }
    }
  });

  $stateProvider.state('login', {
      url: '/login',
      templateUrl: 'views/login.html',
      controller: 'LoginCtrl'
  });

  $stateProvider.state('addResource', {
    url: '/',
    templateUrl: 'views/addResource.html',
    controller: 'ResourceCtrl',
    resolve: {
      topics: function(MainFactory) {
        return MainFactory.fetchTopics();
      }
    }
  });

  $stateProvider.state('plans', {
    url: '/:userId',
    templateUrl: 'views/plans.html',
    controller: 'PlanCtrl',
    resolve: {
      plans: function(MainFactory, $stateParams) {
        return MainFactory.fetchPlans($stateParams.userId);
      }
    }
  });

});
