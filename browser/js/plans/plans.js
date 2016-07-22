app.config(function ($stateProvider) {
    $stateProvider.state('plans', {
        url: '/plans',
        templateUrl: 'js/plans/plans.html',
        controller: 'PlansCtrl',
        resolve: {
            plans: function(PlanFactory, $rootScope, AuthService) {
              if(!$rootScope.user) { // necessary if a user reloads the plan page
                return AuthService.getLoggedInUser()
                .then( function(user) {
                  return PlanFactory.fetchPlansByUser(user.id)
                })
              } else {
                return PlanFactory.fetchPlansByUser($rootScope.user.id)
              }
            }
        }
    });
});

app.controller('PlansCtrl', function($scope, PlanFactory, plans, $rootScope, $uibModal, TopicFactory, $state){

  $scope.plans = plans;

  var userId;
  if($rootScope.user) userId = $rootScope.user.id;

  $rootScope.$on('delete-plan', function(event, data){
    PlanFactory.removePlan(data.planId)
    .then(function(){
      return PlanFactory.fetchPlansByUser(userId)
    })
    .then(function(plans){
      $scope.plans = plans;
    })
  })

  $scope.showPlan = function(planId) {
    $('#plan-nav-' + planId).siblings().removeClass('active');
    $('#plan-nav-' + planId).addClass('active');
    $scope.currentPlan = $scope.plans[getPlanById(planId)];
  }
  // show first plan by default
  if($scope.plans.length > 0) $scope.showPlan($scope.plans[0].id);

  $scope.addNewPlan = function() {
    var addPlanModal = $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addPlan.html',
      controller: 'AddPlanModalCtrl',
      resolve: {
        topics: function() {
          return TopicFactory.fetchAll();
        },
        options: {},
        resources: null
      }
    });
    addPlanModal.result
    .then(function (newPlan) {
      $scope.plans.push(newPlan);
    });
  }

  function getPlanById(id) {
    for(var i=0; i<$scope.plans.length; i++) {
      if($scope.plans[i].id === id) return i;
    }
  }

  // $scope.removePlan = function(id) {
  //     PlanFactory.removePlan(id).then(function() {
  //         return PlanFactory.fetchPlansByUser(userId)
  //     })
  //     .then(function(Plans) { $scope.userPlans = Plans; });
  // };
  //
  // $scope.removeFromPlan = function(planId, resourceId){
  //     PlanFactory.removeResourceFromPlan(planId, resourceId)
  //     .then(function(){
  //         return PlanFactory.fetchPlansByUser(userId)
  //     })
  //     .then(function(Plans){
  //         $scope.userPlans = Plans
  //     });
  // }
  //
  // $scope.moveUp = function(plan, resourceId){
  //     var rArr = plan.resources;
  //
  //     for(var i = 1; i < rArr.length; i++){
  //
  //           if(rArr[i].id === resourceId){
  //             var temp = rArr[i];
  //             rArr[i] = rArr[i-1];
  //             rArr[i-1] = temp;
  //           }
  //
  //     }
  // }
  //
  // $scope.moveDown = function(plan, resourceId){
  //     var rArr = plan.resources;
  //
  //     for(var i = 0; i < rArr.length-1; i++){
  //           if(rArr[i].id === resourceId){
  //             var temp = rArr[i];
  //             rArr[i] = rArr[i+1];
  //             rArr[i+1] = temp;
  //             break;
  //           }
  //     }
  // }

})
