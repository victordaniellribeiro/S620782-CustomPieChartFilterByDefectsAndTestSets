Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',


    layout: 'fit',
    filter: undefined,
    _includeProduction: false,
    _includeAllDefects: false,
    _includeTestSets: false,
    _defects: false,
    _testSets: false,

    config: {
        defaultSettings: {
            types: 'PortfolioItem/Feature',
            chartType: 'piechart',
            aggregationField: 'c_StrategyCategory',
            aggregationType: 'prelimest',
            bucketBy: '',
            stackField: '',
            query: ''
        }
    },



    launch: function() {
        var context =  this.getContext();
        var project = context.getProject()['ObjectID'];
        this._projectId = project;

        console.log('Project:', this._projectId);

        this.myMask = new Ext.LoadMask({
            msg: 'Please wait...',
            target: this
        });

        this._getFilterCombos();


       if (!this.getSetting('types')) {
            this.fireEvent('appsettingsneeded'); //todo: does this work?
        } else {
            Rally.data.wsapi.ModelFactory.getModels({
                types: this._getTypesSetting()
            }).then({
                success: this._onModelsLoaded,
                scope: this
            });
        }
    },


    _getFilterCombos: function() {
        this.add([
        {
            xtype: 'panel',
            id: 'panelGraph',
            // title: 'Filter:',
            // flex: 3,
            align: 'stretch',
            bodyPadding: 10,
            items: [{
                xtype: 'fieldcontainer',
                defaultType: 'checkboxfield',
                layout: 'hbox',
                width: 500,
                // defaults: {
                //     flex: 3,
                // },

                items: [
                    {
                        boxLabel  : 'Include Production Support',
                        id        : 'includeP',
                        name      : 'includeP',
                        padding: '0 20 0 0',                        
                        inputValue: 'p',
                        listeners: {
                            change: function(field, newValue, oldValue) {
                                this.myMask.show();
                                var include = newValue;
                                this._includeProduction = include;

                                console.log('include production support:', include);


                                if (include) {
                                    if (Ext.getCmp('includeD').getValue()) {
                                        Ext.getCmp('includeD').setValue(false);
                                    }

                                    var promise = this._loadDefects().then({
                                        success: function(defects) {
                                            console.log('defects loaded:',defects);
                                            this._defects = defects;
                                            this.onTimeboxScopeChange();
                                        },
                                        failure: function(error) {
                                            console.log('error:', error);
                                        },
                                        scope: this
                                    });
                                } else {
                                    if (!Ext.getCmp('includeD').getValue()) {
                                        this.onTimeboxScopeChange();
                                    }
                                }
                            },
                            scope: this
                        }
                    },
                    {
                        boxLabel  : 'Include All Defects',
                        id        : 'includeD',
                        name      : 'includeD',
                        padding: '0 20 0 0',                        
                        inputValue: 'd',
                        listeners: {
                            change: function(field, newValue, oldValue) {
                                this.myMask.show();
                                var include = newValue;
                                this._includeAllDefects = include;
                                console.log('include all defects:', include);

                                if (include) {
                                    if (Ext.getCmp('includeP').getValue()) {
                                        Ext.getCmp('includeP').setValue(false);
                                    }
                                    var promise = this._loadDefects().then({
                                        success: function(defects) {
                                            console.log('all defects loaded:',defects);
                                            this._defects = defects;
                                            this.onTimeboxScopeChange();
                                        },
                                        failure: function(error) {
                                            console.log('error:', error);
                                        },
                                        scope: this
                                    });
                                } else {
                                    if (!Ext.getCmp('includeP').getValue()) {
                                        this.onTimeboxScopeChange();
                                    }
                                }
                            },
                            scope: this
                        }
                    },
                    {
                        boxLabel  : 'Include TestSets',
                        id        : 'includeT',
                        name      : 'includeT',
                        padding: '0 20 0 0',                        
                        inputValue: 't',
                        listeners: {
                            change: function(field, newValue, oldValue) {
                                this.myMask.show();
                                var include = newValue;
                                this._includeTestSets = include;

                                console.log('include testSets:', include);


                                var promise = this._loadTestSets().then({
                                    success: function(testSets) {
                                        console.log('all `testSets loaded:', testSets);
                                        this._testSets = testSets;
                                        this.onTimeboxScopeChange();
                                    },
                                    failure: function(error) {
                                        console.log('error:', error);
                                    },
                                    scope: this
                                }); 
                            },
                            scope: this
                        }
                    }
                ],
            }]
        }]);
    },


    _loadDefects: function() {
        var project = this._projectId;
        console.log('project:', project);

        var deferred = Ext.create('Deft.Deferred');

        var filter = this._getFilter();

        Ext.create('Rally.data.wsapi.Store', {
            model: 'Defect',
            autoLoad: true,
            fetch: ['Name', 'ObjectID', 'FormattedID', 'PlanEstimate', 'Environment', 'Release'],
            context: {
                projectScopeUp: false,
                projectScopeDown: true,
                project: /project/ + project //null to search all workspace
            },
            filters: filter,
            limit: Infinity,
            listeners: {
                load: function(store, data, success) {
                    console.log('defects store', store, data);

                    deferred.resolve(data);
                }
            }, scope: this
        });

        return deferred.promise;
    },



    _loadTestSets: function() {
        var project = this._projectId;
        console.log('project:', project);

        var deferred = Ext.create('Deft.Deferred');

        var filter = this._getCustomFilters();

        Ext.create('Rally.data.wsapi.Store', {
            model: 'TestSet',
            autoLoad: true,
            fetch: ['Name', 'ObjectID', 'FormattedID', 'PlanEstimate', 'Release'],
            context: {
                projectScopeUp: false,
                projectScopeDown: true,
                project: /project/ + project //null to search all workspace
            },
            filters: filter,
            limit: Infinity,
            listeners: {
                load: function(store, data, success) {
                    console.log('testSet store', store, data);

                    deferred.resolve(data);
                }
            }, scope: this
        });

        return deferred.promise;
    },


    _getFilter: function() {
        var customFilters = this._getCustomFilters();

        var filter;

        if (this._includeProduction) {
            filter = Rally.data.QueryFilter.or([
                {
                    property: 'Environment',
                    operator: '=',
                    value: 'Production'
                },
                {
                    property: 'Environment',
                    operator: '=',
                    value: ''
                }   
            ]);
        } else if (this._includeAllDefects) {
            filter = [];
        }


        if (!filter || filter.length === 0) {
            return customFilters;
        } else if (customFilters) {
            filter = customFilters.and(filter);
        } else {
            return filter;
        }

        console.log('final filter', filter);
        console.log('final filter string', filter.toString());

        return filter;
    },


    _getCustomFilters: function() {
        console.log('filters: currentCustom:', Ext.getCmp('panelGraph').items.get(1).currentCustomFilter.filters);
        var customFilters = Ext.getCmp('panelGraph').items.get(1).currentCustomFilter.filters[0];

        return customFilters;
    },


    getSettingsFields: function() {
       return Settings.getSettingsFields(this.getContext());
    },


    _shouldLoadAllowedStackValues: function(stackingField) {
      var hasAllowedValues = stackingField && stackingField.hasAllowedValues(), 
          shouldLoadAllowedValues = hasAllowedValues && (
            _.contains(['state', 'rating', 'string'], stackingField.getType()) ||
            stackingField.getAllowedValueType() === 'state' ||
            stackingField.getAllowedValueType() === 'flowstate'
          );
      return shouldLoadAllowedValues;
    },

    _onModelsLoaded: function(models) {
        this.models = _.values(models);
        var model = this.models[0],
            stackingSetting = this._getStackingSetting(),
            stackingField = stackingSetting && model.getField(stackingSetting);
            
        if (this._shouldLoadAllowedStackValues(stackingField)) {
            stackingField.getAllowedValueStore().load().then({
                success: function(records) {
                    this.stackValues = _.invoke(records, 'get', 'StringValue');
                    this._addChart();
                },
                scope: this
            });
        } else {
            this._addChart();
        }
    },

    _addChart: function() {
        var context = this.getContext();
        var whiteListFields = ['Milestones', 'Tags'];
        var modelNames = _.pluck(this.models, 'typePath');

        var gridBoardConfig = {
            xtype: 'rallygridboard',
            toggleState: 'chart',
            chartConfig: this._getChartConfig(),
            plugins: [{
                ptype:'rallygridboardinlinefiltercontrol',
                showInChartMode: true,
                inlineFilterButtonConfig: {
                    stateful: true,
                    stateId: context.getScopedStateId('filters'),
                    filterChildren: true,
                    modelNames: modelNames,
                    inlineFilterPanelConfig: {
                        quickFilterPanelConfig: {
                            defaultFields: this._getQuickFilters(),
                            addQuickFilterConfig: {
                               whiteListFields: whiteListFields
                            }
                        },
                        advancedFilterPanelConfig: {
                           advancedFilterRowsConfig: {
                               propertyFieldConfig: {
                                   whiteListFields: whiteListFields
                               }
                           }
                       }
                    }
                }
            },
            {
                ptype: 'rallygridboardactionsmenu',
                menuItems: [{
                    text: 'Export to CSV...',
                    handler: function() {
                        window.location = Rally.ui.gridboard.Export.buildCsvExportUrl(this.down('rallygridboard').getGridOrBoard());
                    },
                    scope: this
                }],
                buttonConfig: {
                    iconCls: 'icon-export',
                    toolTipConfig: {
                        html: 'Export',
                        anchor: 'top',
                        hideDelay: 0
                    }
                }
            }],
            context: context,
            modelNames: modelNames,
            storeConfig: {
                filters: this._getFilters()
            }
        };

        //console.log(this.down('#panelGraph'));
        this.down('#panelGraph').add(gridBoardConfig);

        console.log('comp', Ext.getCmp('panelGraph'));


        // this.add(gridBoardConfig);
    },

    _getQuickFilters: function() {
        var quickFilters = ['Owner', 'State', 'ScheduleState'],
            model = this.models[0];
        if (this.models.length > 1) {
            quickFilters.push('ModelType');
        }

        return _.filter(quickFilters, function(quickFilter) {
            return model.hasField(quickFilter);
        });
    },

    _getTypesSetting: function() {
        return this.getSetting('types').split(',');
    },

    _getStackingSetting: function() {
        var chartType = this.getSetting('chartType');
        return chartType !== 'piechart' ? this.getSetting('stackField') : null;
    },

    _getChartConfig: function() {
        var chartType = this.getSetting('chartType'),
            stackField = this._getStackingSetting(),
            stackValues = this.stackValues,
            model = this.models[0],
            config = {
                xtype: chartType,
                height: 250,
                enableStacking: !!stackField,
                chartColors: [
                "#FF8200", // $orange
                "#F6A900", // $gold
                "#FAD200", // $yellow
                "#8DC63F", // $lime
                "#1E7C00", // $green_dk
                "#337EC6", // $blue_link
                "#005EB8", // $blue
                "#7832A5", // $purple,
                "#DA1884",  // $pink,
                "#C0C0C0" // $grey4
                ],
                storeConfig: {
                    context: this.getContext().getDataContext(),
                    //TODO: can we do summary fetch here and not limit infinity?
                    //we'll have to also make sure the fetch is correct for export somehow...
                    limit: Infinity,
                    fetch: this._getChartFetch(),
                    sorters: this._getChartSort(),
                    pageSize: 2000,
                },
                calculatorConfig: {
                    calculationType: this.getSetting('aggregationType'),
                    field: this.getSetting('aggregationField'),
                    stackField: stackField,
                    stackValues: stackValues,
                    bucketBy: chartType === 'piechart' ? null : this.getSetting('bucketBy'),
                    includeProduction: this._includeProduction,
                    includeAllDefects: this._includeAllDefects,
                    includeTestSets: this._includeTestSets,
                    projectId: this._projectId,
                    defects: this._defects,
                    testSets: this._testSets
                }
            };

        if (model.isArtifact()) {
            config.storeConfig.models = this._getTypesSetting();
            config.storeType = 'Rally.data.wsapi.artifact.Store';
        } else {
            config.storeConfig.model = model;
            config.storeType = 'Rally.data.wsapi.Store';
        }

        return config;
    },

    onTimeboxScopeChange: function() {
        this.callParent(arguments);

        var gridBoard = this.down('rallygridboard');
        if (gridBoard) {
            gridBoard.destroy();
        }

        this._addChart();
        this.myMask.hide();
    },

    _getChartFetch: function() {
        var field = this.getSetting('aggregationField'),
            aggregationType = this.getSetting('aggregationType'),
            stackField = this._getStackingSetting(),
            fetch = ['FormattedID', 'Name', field];

        if (aggregationType !== 'count') {
            fetch.push(Utils.getFieldForAggregationType(aggregationType));
        }
        if (stackField) {
            fetch.push(stackField);
        }

        if (_.contains(fetch, 'Iteration')) {
            fetch.push('StartDate');
        }
        if (_.contains(fetch, 'Release')) {
            fetch.push('ReleaseStartDate');
        }

        return fetch;
    },

    _getChartSort: function() {
        var model = this.models[0],
            field = model.getField(this.getSetting('aggregationField')),
            sorters = [];

        if (field && field.getType() !== 'collection' && field.sortable) {
            sorters.push({
                property: this.getSetting('aggregationField'),
                direction: 'ASC'
            });
        }

        return sorters;
    },

    _getFilters: function() {
        console.log('get filters', this.getContext(), this.getContext().getTimeboxScope());
        var queries = [],
            timeboxScope = this.getContext().getTimeboxScope();
        if (this.getSetting('query')) {
            var querySetting = this.getSetting('query').replace(/\{user\}/g, this.getContext().getUser()._ref);
            queries.push(Rally.data.QueryFilter.fromQueryString(querySetting));
        }
        if (timeboxScope && _.any(this.models, timeboxScope.isApplicable, timeboxScope)) {
            queries.push(timeboxScope.getQueryFilter());
        }

        console.log('query', queries);
        return queries;
    }

    
});
