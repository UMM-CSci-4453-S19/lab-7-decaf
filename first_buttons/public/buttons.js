angular.module('buttons',[]) 
  .controller('buttonCtrl',ButtonCtrl)
  .factory('buttonApi',buttonApi)
  .constant('apiUrl','http://localhost:1337'); // CHANGED for the lab 2017!

function ButtonCtrl($scope,buttonApi){
   $scope.buttons=[]; // Initially all was still
   $scope.errorMessage='';
   $scope.isLoading=isLoading;
   $scope.refreshButtons=refreshButtons;

   var loading = false;

   function isLoading(){
    return loading;
   }
   
  function refreshButtons(){
    loading=true;
    $scope.errorMessage='';
    buttonApi.getButtons()
      .success(function(data){
         $scope.buttons=data;
         loading=false;
      })
      .error(function () {
          $scope.errorMessage="Unable to load Buttons:  API request failed";
          loading=false;
      });
 }
 refreshButtons();
}

function buttonApi($http,apiUrl){
  return{
    getButtons: function(){
      var url = apiUrl + '/buttons';
      return $http.get(url);
    }
 };
}
