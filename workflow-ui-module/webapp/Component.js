sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "wiprofrm/workflowuimodule/model/models"
], function (UIComponent, Device, models) {
  "use strict";

  return UIComponent.extend("wiprofrm.workflowuimodule.Component", {
      metadata: {
          manifest: "json"
      },

      /**
       * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
       * @public
       * @override
       */
      init: function () {
          // call the base component's init function
          UIComponent.prototype.init.apply(this, arguments);

          // enable routing
          this.getRouter().initialize();

          // set the device model
          this.setModel(models.createDeviceModel(), "device");

          // Check and set task models
          var componentData = this.getComponentData();
          if (componentData && componentData.startupParameters) {
              this.setTaskModels(componentData.startupParameters);
              this.setupInboxActions(componentData.startupParameters.inboxAPI);
          } else {
              console.error("Startup parameters are missing.");
          }
      },

      setTaskModels: function (startupParameters) {
          if (startupParameters && startupParameters.taskModel) {
              // set the task model
              this.setModel(startupParameters.taskModel, "task");

              // set the task context model
              var taskContextModel = new sap.ui.model.json.JSONModel(this._getTaskInstancesBaseURL() + "/context");
              this.setModel(taskContextModel, "context");
          } else {
              console.error("Task model startup parameter is missing.");
          }
      },

      _getTaskInstancesBaseURL: function () {
          return this._getWorkflowRuntimeBaseURL() + "/task-instances/" + this.getTaskInstanceID();
      },

      _getWorkflowRuntimeBaseURL: function () {
          var appId = this.getManifestEntry("/sap.app/id");
          var appPath = appId.replace(/\./g, "/");
          var appModulePath = jQuery.sap.getModulePath(appPath);

          return appModulePath + "/bpmworkflowruntime/v1";
      },

      getTaskInstanceID: function () {
          var taskModel = this.getModel("task");
          return taskModel ? taskModel.getData().InstanceID : "";
      },

      getInboxAPI: function () {
          var componentData = this.getComponentData();
          return componentData && componentData.startupParameters ? componentData.startupParameters.inboxAPI : null;
      },

      setupInboxActions: function (inboxAPI) {
          if (inboxAPI) {
              inboxAPI.addAction({
                  action: "APPROVE",
                  label: "Approve",
                  type: "accept" // (Optional property) Define for positive appearance
              }, function () {
                  this.completeTask(true);
              }, this);

              inboxAPI.addAction({
                  action: "REJECT",
                  label: "Reject",
                  type: "reject" // (Optional property) Define for negative appearance
              }, function () {
                  this.completeTask(false);
              }, this);
          } else {
              console.error("Inbox API is missing.");
          }
      },

      completeTask: function (approvalStatus) {
          this.getModel("context").setProperty("/approved", approvalStatus);
          this._patchTaskInstance();
          this._refreshTaskList();
      },

      _patchTaskInstance: function () {
          var data = {
              status: "COMPLETED",
              context: this.getModel("context").getData()
          };

          jQuery.ajax({
              url: this._getTaskInstancesBaseURL(),
              method: "PATCH",
              contentType: "application/json",
              async: false,
              data: JSON.stringify(data),
              headers: {
                  "X-CSRF-Token": this._fetchToken()
              }
          });
      },

      _fetchToken: function () {
          var fetchedToken;

          jQuery.ajax({
              url: this._getWorkflowRuntimeBaseURL() + "/xsrf-token",
              method: "GET",
              async: false,
              headers: {
                  "X-CSRF-Token": "Fetch"
              },
              success: function (result, xhr, data) {
                  fetchedToken = data.getResponseHeader("X-CSRF-Token");
              }
          });
          return fetchedToken;
      },

      _refreshTaskList: function () {
          var inboxAPI = this.getInboxAPI();
          if (inboxAPI) {
              inboxAPI.updateTask("NA", this.getTaskInstanceID());
          } else {
              console.error("Inbox API is not available to refresh the task list.");
          }
      }
  });
});
